import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import type { BiosCheckItem } from '../../shared/types';

/**
 * "SAFE BIOS OPTIMIZATION CHECK" — read-only detection only. Frontier
 * Tweaks never flashes firmware or writes BIOS/UEFI settings directly; a
 * handful of these ARE readable from Windows (virtualization firmware
 * flag, Secure Boot state), and we report those honestly. Everything else
 * genuinely requires the motherboard vendor's own BIOS/UEFI interface, so
 * we say that plainly instead of inventing a detection we can't back up.
 */
export async function runBiosCheck(): Promise<BiosCheckItem[]> {
  const items: BiosCheckItem[] = [];

  // Virtualization enabled in firmware — real, via CIM.
  const virt = await runPowerShell(
    "(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled | ConvertTo-Json -Compress",
    10000
  );
  let virtState: BiosCheckItem['state'] = 'unknown';
  let virtDetail = 'Could not query CPU virtualization state.';
  if (virt.success && virt.stdout) {
    const raw = virt.stdout.trim().toLowerCase();
    const enabled = raw === 'true' || raw.startsWith('[true');
    const disabled = raw === 'false' || raw.startsWith('[false');
    virtState = enabled ? 'enabled' : disabled ? 'disabled' : 'unknown';
    virtDetail = enabled
      ? 'Hardware virtualization (VT-x/AMD-V) is enabled in firmware.'
      : disabled
        ? 'Hardware virtualization is disabled in firmware.'
        : 'Windows could not report a definitive value for this CPU.';
  }
  items.push({
    id: 'virtualization',
    name: 'Hardware Virtualization',
    description: 'Required for Hyper-V, WSL2, Core Isolation/VBS, and most modern anti-cheat systems.',
    state: virtState,
    detail: virtDetail,
    manualInstructions:
      virtState === 'disabled'
        ? 'Enable "Intel VT-x" / "SVM Mode" (AMD) in your BIOS/UEFI under CPU or Advanced settings, then restart.'
        : undefined,
  });

  // Secure Boot — real, via Confirm-SecureBootUEFI.
  const sb = await runPowerShell(
    "try { Confirm-SecureBootUEFI } catch { 'NOT_UEFI' }",
    10000
  );
  let sbState: BiosCheckItem['state'] = 'unknown';
  let sbDetail = 'Could not query Secure Boot state.';
  if (sb.success) {
    const raw = sb.stdout.trim();
    if (raw === 'True') {
      sbState = 'enabled';
      sbDetail = 'Secure Boot is enabled.';
    } else if (raw === 'False') {
      sbState = 'disabled';
      sbDetail = 'Secure Boot is disabled.';
    } else {
      sbState = 'not-detectable';
      sbDetail = 'This system is running in Legacy BIOS mode, or Secure Boot state could not be read.';
    }
  }
  items.push({
    id: 'secure-boot',
    name: 'Secure Boot',
    description: 'A UEFI security feature required by Core Isolation, VBS, and some anti-cheat engines.',
    state: sbState,
    detail: sbDetail,
    manualInstructions:
      sbState === 'disabled' || sbState === 'not-detectable'
        ? 'Enable Secure Boot in your BIOS/UEFI under Boot or Security settings (requires a GPT disk in UEFI mode).'
        : undefined,
  });

  // Resizable BAR / Above 4G Decoding — NOT reliably readable from Windows
  // without a vendor-specific WMI extension. Rather than guess, tell the
  // user exactly where to check.
  items.push({
    id: 'resizable-bar',
    name: 'Resizable BAR / Above 4G Decoding',
    description: 'Lets the CPU access the entire GPU memory frame buffer at once, improving performance in supported titles.',
    state: 'not-detectable',
    detail: 'Windows has no standard API to read this setting — it is not exposed outside your motherboard\u2019s own firmware.',
    manualInstructions: 'Check your BIOS/UEFI under Advanced \u2192 PCI Subsystem Settings (or similar) for "Above 4G Decoding" and "Re-Size BAR Support".',
  });

  // PCIe link state power management — reported via powercfg query, real
  // but only reflects the OS-side setting, not the firmware's own PCIe ASPM.
  const pcie = await runPowerShell(
    'powercfg /q SCHEME_CURRENT SUB_PCIEXPRESS ASPM',
    10000
  );
  items.push({
    id: 'pcie-link-state',
    name: 'PCIe Link State Power Management (OS setting)',
    description: 'Windows\u2019 own PCIe Active State Power Management policy for the current power plan.',
    state: pcie.success && /Off|0x00000000/i.test(pcie.stdout) ? 'disabled' : pcie.success ? 'enabled' : 'unknown',
    detail: pcie.success
      ? 'Read from the active power plan\u2019s PCI Express settings.'
      : 'Could not query the active power plan.',
    manualInstructions: 'The firmware-level PCIe ASPM policy itself can only be changed in your BIOS/UEFI, not from Windows.',
  });

  // XMP / EXPO — not readable from the OS at all.
  items.push({
    id: 'memory-profile',
    name: 'XMP / EXPO Memory Profile',
    description: 'Runs RAM at its rated speed/timings instead of the JEDEC default.',
    state: 'not-detectable',
    detail: 'Memory profile status is firmware-only information and is not exposed to Windows.',
    manualInstructions: 'Check your BIOS/UEFI under Memory/DRAM settings for "XMP" (Intel) or "EXPO" (AMD) and confirm a profile is selected.',
  });

  return items;
}

export async function biosCheckSafe(): Promise<BiosCheckItem[]> {
  try {
    return await runBiosCheck();
  } catch (err) {
    logger.error('bios-check-failed', { error: String(err) });
    return [];
  }
}
