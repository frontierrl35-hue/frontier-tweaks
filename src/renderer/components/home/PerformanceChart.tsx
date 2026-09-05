import { useEffect, useRef, useState } from 'react';
import type { UsageSnapshot } from '../../../shared/types';

type Metric = 'CPU' | 'GPU' | 'RAM';
const METRICS: Metric[] = ['CPU', 'GPU', 'RAM'];
const POINTS = 21;
const WIDTH = 640;
const HEIGHT = 320;
const POLL_MS = 3000;
const TIME_LABELS = ['60 seconds', '45 seconds', '30 seconds', '15 seconds', '0 seconds'];
const Y_LABELS = [100, 80, 60, 40, 20, 0];

function buildPath(values: number[]) {
  const step = WIDTH / (values.length - 1);
  const coords = values.map((v, i) => [i * step, HEIGHT - (v / 100) * HEIGHT] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const last = coords[coords.length - 1];
  return { line, area, last };
}

export function PerformanceChart({ subtitle }: { subtitle: string }) {
  const [metric, setMetric] = useState<Metric>('CPU');
  // Backed by real samples from the main process (system:getUsage) — CPU is a
  // live delta-based load sample, RAM is live os.totalmem/freemem, and GPU is
  // a live performance-counter read that can legitimately be unavailable on
  // some drivers. Nothing here is randomly generated.
  const [series, setSeries] = useState<Record<Metric, number[]>>({
    CPU: Array(POINTS).fill(0),
    GPU: Array(POINTS).fill(0),
    RAM: Array(POINTS).fill(0),
  });
  const [current, setCurrent] = useState<Record<Metric, number | null>>({ CPU: null, GPU: null, RAM: null });
  const [gpuAvailable, setGpuAvailable] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const res = await window.frontier.system.getUsage();
      if (cancelled || !res.success || !res.data) return;
      const snap = res.data as UsageSnapshot;

      setCurrent({ CPU: snap.cpuPercent, GPU: snap.gpuPercent, RAM: snap.ramPercent });
      setGpuAvailable(snap.gpuPercent !== null);

      setSeries((prev) => ({
        CPU: [...prev.CPU.slice(1), snap.cpuPercent],
        RAM: [...prev.RAM.slice(1), snap.ramPercent],
        // GPU counter isn't published on every driver — hold the last known
        // value instead of plotting a fabricated point when it's null.
        GPU: [...prev.GPU.slice(1), snap.gpuPercent ?? prev.GPU[prev.GPU.length - 1]],
      }));
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const { line, area, last } = buildPath(series[metric]);
  const showGpuUnavailable = metric === 'GPU' && gpuAvailable === false;
  const readout = current[metric];

  return (
    <div className="ft-card p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-medium text-[var(--ft-text-primary)]">{subtitle}</div>
          <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">
            {readout !== null ? `${metric} usage — ${readout}%` : 'Reading live usage…'}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[var(--ft-radius-pill)] p-1">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`no-drag px-3.5 py-1.5 text-xs font-medium rounded-[var(--ft-radius-pill)] transition-all ${
                metric === m
                  ? 'bg-[var(--ft-surface-raised)] text-[var(--ft-text-primary)]'
                  : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)]'
              }`}
            >
              {m}
              {current[m] !== null && <span className="ml-1.5 text-[10px] text-[var(--ft-text-muted)]">{current[m]}%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex flex-col justify-between text-[11px] text-[var(--ft-text-muted)] py-1 shrink-0">
          {Y_LABELS.map((y) => (
            <span key={y}>{y}%</span>
          ))}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {showGpuUnavailable ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-[var(--ft-text-muted)] border border-dashed border-[var(--ft-border)] rounded-[var(--ft-radius-md)] px-6">
              GPU usage counters aren't published by this system's graphics driver, so this metric can't be shown live.
            </div>
          ) : (
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full flex-1" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ft-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ft-accent)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="var(--ft-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {Y_LABELS.map((y) => (
                <line
                  key={y}
                  x1={0}
                  x2={WIDTH}
                  y1={HEIGHT - (y / 100) * HEIGHT}
                  y2={HEIGHT - (y / 100) * HEIGHT}
                  stroke="var(--ft-border)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
              <path d={area} fill="url(#ft-chart-fill)" />
              <path d={line} fill="none" stroke="var(--ft-accent)" strokeWidth={2} />
              {last && <circle cx={last[0]} cy={last[1]} r={4.5} fill="var(--ft-accent)" />}
            </svg>
          )}
          <div className="flex items-center justify-between text-[11px] text-[var(--ft-text-muted)] mt-2">
            {TIME_LABELS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
