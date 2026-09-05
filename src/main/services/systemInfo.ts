import os from 'node:os';
import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import type { HardwareSnapshot, SystemInfoSnapshot, UsageSnapshot } from '../../shared/types';

/**
 * All values here come from Node's `os` module or live PowerShell/CIM
 * queries against the real machine — never fabricated. If a PowerShell
 * query fails (e.g. running in dev on non-Windows, or WMI unavailable),
 * the field falls back to 'Unknown' rather than a made-up value.
 */

async function psJson<T>(script: string, fallback: T): Promise<T> {
  const res = await runPowerShell(`${script} | ConvertTo-Json -Compress`, 12000);
  if (!res.success || !res.stdout) return fallback;
  try {
    return JSON.parse(res.stdout) as T;
  } catch (err) {
    logger.warn('psjson-parse-failed', { error: String(err) });
    return fallback;
  }
}

export async function getSystemInfo(): Promise<SystemInfoSnapshot> {
  const cpuInfo = os.cpus();
  const cpuModel = cpuInfo[0]?.model?.trim() || 'Unknown CPU';
  const speedGHz = cpuInfo[0] ? Number((cpuInfo[0].speed / 1000).toFixed(2)) : 0;

  const gpuRaw = await psJson<Array<{ Name: string }>>(
    'Get-CimInstance Win32_VideoController | Select-Object Name',
    []
  );
  const gpu = (Array.isArray(gpuRaw) ? gpuRaw : gpuRaw ? [gpuRaw] : []).map((g) => ({
    model: g?.Name || 'Unknown GPU',
  }));

  const osRaw = await psJson<{ Caption?: string; BuildNumber?: string; OSArchitecture?: string; Version?: string }>(
    'Get-CimInstance Win32_OperatingSystem | Select-Object Caption,BuildNumber,OSArchitecture,Version',
    {}
  );

  return {
    cpu: { model: cpuModel, cores: cpuInfo.length, speedGHz },
    gpu: gpu.length ? gpu : [{ model: 'Unknown GPU' }],
    ram: {
      totalGB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
      freeGB: Number((os.freemem() / 1024 ** 3).toFixed(1)),
    },
    os: {
      distro: osRaw.Caption || `${os.type()} ${os.release()}`,
      release: osRaw.Version || os.release(),
      build: osRaw.BuildNumber || 'Unknown',
      arch: osRaw.OSArchitecture || os.arch(),
    },
    uptimeSeconds: os.uptime(),
    hostname: os.hostname(),
  };
}

/** Snapshots os.cpus() core time counters. Used twice, a short interval
 *  apart, to compute a real delta-based CPU load — this is the same
 *  technique `top`/Task Manager use, not an estimate from a single sample. */
function cpuTimeSnapshot() {
  return os.cpus().map((c) => {
    const { user, nice, sys, idle, irq } = c.times;
    return { idle: idle, total: user + nice + sys + idle + irq };
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Real CPU load % over a short sampling window (delta of core busy time). */
async function sampleCpuPercent(windowMs = 200): Promise<number> {
  const start = cpuTimeSnapshot();
  await sleep(windowMs);
  const end = cpuTimeSnapshot();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < end.length; i++) {
    idleDelta += end[i].idle - (start[i]?.idle ?? end[i].idle);
    totalDelta += end[i].total - (start[i]?.total ?? end[i].total);
  }
  if (totalDelta <= 0) return 0;
  const busyFraction = 1 - idleDelta / totalDelta;
  return Math.min(100, Math.max(0, Math.round(busyFraction * 1000) / 10));
}

/** Real GPU load % via Windows' "GPU Engine" performance counter set, summed
 *  across 3D engine instances (every adapter + process using the GPU). Not
 *  every driver publishes this counter set, so a failure/empty result
 *  returns `null` — the UI must show that as "unavailable", never a guess. */
async function sampleGpuPercent(): Promise<number | null> {
  const script = `
    try {
      $samples = (Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -ErrorAction Stop).CounterSamples
      $sum = ($samples | Measure-Object -Property CookedValue -Sum).Sum
      [math]::Round($sum, 1)
    } catch { '__NA__' }
  `;
  const res = await runPowerShell(script, 5000);
  const value = res.stdout.trim();
  if (!res.success || value === '__NA__' || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.min(100, Math.max(0, num));
}

/** Live CPU/RAM/GPU usage, sampled fresh on every call — this is what backs
 *  the HWMONITOR chart on Home. Nothing here is simulated: CPU comes from a
 *  real short-window delta sample, RAM from live os.totalmem/freemem, and
 *  GPU from a live performance-counter read (or `null` if unsupported). */
export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const [cpuPercent, gpuPercent] = await Promise.all([sampleCpuPercent(), sampleGpuPercent()]);
  const ramPercent = Math.min(100, Math.max(0, Math.round((1 - os.freemem() / os.totalmem()) * 1000) / 10));
  return { cpuPercent, ramPercent, gpuPercent };
}

export async function getHardwareInfo(): Promise<HardwareSnapshot> {
  const base = await getSystemInfo();

  const board = await psJson<{ Manufacturer?: string; Product?: string }>(
    'Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product',
    {}
  );

  const biosRaw = await psJson<{ Manufacturer?: string; SMBIOSBIOSVersion?: string }>(
    'Get-CimInstance Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion',
    {}
  );

  const disksRaw = await psJson<Array<{ Model?: string; Size?: string; MediaType?: string }>>(
    'Get-CimInstance Win32_DiskDrive | Select-Object Model,Size,MediaType',
    []
  );
  const disks = (Array.isArray(disksRaw) ? disksRaw : disksRaw ? [disksRaw] : []).map((d) => ({
    device: d?.Model || 'Unknown Drive',
    sizeGB: d?.Size ? Number((Number(d.Size) / 1024 ** 3).toFixed(0)) : 0,
    type: d?.MediaType || 'Unknown',
  }));

  const netRaw = await psJson<Array<{ Name?: string; MacAddress?: string; MediaType?: string }>>(
    "Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.NetConnectionStatus -eq 2 } | Select-Object Name,MacAddress,AdapterType",
    []
  );
  const network = (Array.isArray(netRaw) ? netRaw : netRaw ? [netRaw] : []).map((n) => ({
    iface: n?.Name || 'Unknown Adapter',
    mac: n?.MacAddress || 'Unknown',
    type: n?.MediaType || 'Unknown',
  }));

  return {
    ...base,
    motherboard: { manufacturer: board.Manufacturer || 'Unknown', model: board.Product || 'Unknown' },
    storage: disks.length ? disks : [{ device: 'Unknown Drive', sizeGB: 0, type: 'Unknown' }],
    bios: { vendor: biosRaw.Manufacturer || 'Unknown', version: biosRaw.SMBIOSBIOSVersion || 'Unknown' },
    network: network.length ? network : [{ iface: 'Unknown Adapter', mac: 'Unknown', type: 'Unknown' }],
  };
}
