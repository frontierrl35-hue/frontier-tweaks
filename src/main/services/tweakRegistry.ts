import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import { readState, writeBackupBlob } from './stateStore';
import type { OperationResult, TweakMeta } from '../../shared/types';

export interface TweakImpl extends TweakMeta {
  /** Returns whether the tweak currently appears applied on this machine. */
  detect: () => Promise<'applied' | 'not-applied' | 'unknown' | 'unsupported'>;
  apply: () => Promise<OperationResult>;
  revert: () => Promise<OperationResult>;
}

/**
 * Helper: reads a registry value with PowerShell, returns null if missing.
 * Used by detect() so status reflects real machine state, not local guesses.
 */
async function getRegValue(pathArg: string, name: string): Promise<string | null> {
  const script = `try { (Get-ItemProperty -Path '${pathArg}' -Name '${name}' -ErrorAction Stop).'${name}' } catch { '__MISSING__' }`;
  const res = await runPowerShell(script, 8000);
  const value = res.stdout.trim();
  return value === '__MISSING__' || value === '' ? null : value;
}

async function setRegValue(pathArg: string, name: string, value: string | number, type: 'DWord' | 'String'): Promise<OperationResult> {
  const script = `
    if (-not (Test-Path '${pathArg}')) { New-Item -Path '${pathArg}' -Force | Out-Null }
    New-ItemProperty -Path '${pathArg}' -Name '${name}' -Value ${type === 'DWord' ? value : `'${value}'`} -PropertyType ${type} -Force | Out-Null
    Write-Output 'OK'
  `;
  const res = await runPowerShell(script);
  return res.success
    ? { success: true, message: 'Registry value updated.' }
    : { success: false, message: 'Failed to update registry value.', error: res.stderr || res.stdout };
}

/** Reads a Windows service's current StartMode ('Auto' | 'Manual' | 'Disabled'). */
async function getServiceStartMode(serviceName: string): Promise<string | null> {
  const script = `try { (Get-CimInstance Win32_Service -Filter "Name='${serviceName}'" -ErrorAction Stop).StartMode } catch { '__MISSING__' }`;
  const res = await runPowerShell(script, 8000);
  const value = res.stdout.trim();
  return value === '__MISSING__' || value === '' ? null : value;
}

/** Sets a service's start mode and, for 'Disabled', stops it if running. Backs up the original mode first. */
async function backupThenSetService(id: string, serviceName: string, mode: 'Disabled' | 'Manual' | 'Automatic'): Promise<OperationResult> {
  const original = await getServiceStartMode(serviceName);
  await writeBackupBlob(id, { serviceName, original });
  const script = `
    Set-Service -Name '${serviceName}' -StartupType ${mode} -ErrorAction Stop
    ${mode === 'Disabled' ? `Stop-Service -Name '${serviceName}' -Force -ErrorAction SilentlyContinue` : ''}
    Write-Output 'OK'
  `;
  const res = await runPowerShell(script, 15000);
  return res.success
    ? { success: true, message: `Service '${serviceName}' set to ${mode}.` }
    : { success: false, message: `Could not change service '${serviceName}'. It may not exist on this system.`, error: res.stderr };
}

/** Restores a service to its backed-up start mode (falls back to Automatic). */
async function restoreServiceFromBackup(id: string, serviceName: string): Promise<OperationResult> {
  const state = await readState();
  const blob = state.backups?.[id] as { original: string | null } | undefined;
  const original = blob?.original;
  const mode = original === 'Disabled' ? 'Disabled' : original === 'Manual' ? 'Manual' : 'Automatic';
  const script = `
    Set-Service -Name '${serviceName}' -StartupType ${mode} -ErrorAction Stop
    if ('${mode}' -ne 'Disabled') { Start-Service -Name '${serviceName}' -ErrorAction SilentlyContinue }
    Write-Output 'OK'
  `;
  const res = await runPowerShell(script, 15000);
  return res.success
    ? { success: true, message: `Service '${serviceName}' restored to ${mode}.` }
    : { success: false, message: `Could not restore service '${serviceName}'.`, error: res.stderr };
}

/** Builds a dangerous tweak whose UI (warning banner, confirmation dialog,
 *  status) is fully wired, but whose actual system-level effect is not yet
 *  implemented. Used for security-weakening changes that need a real audit
 *  before Frontier Tweaks is allowed to touch them — never silently weaken
 *  Windows security. */
function pendingDangerousTweak(meta: Omit<TweakMeta, 'reversible' | 'dangerous'> & { warning: string }): TweakImpl {
  const { warning, ...rest } = meta;
  return {
    ...rest,
    reversible: true,
    dangerous: true,
    dangerWarning: warning,
    async detect() {
      return 'not-applied';
    },
    async apply() {
      return { success: false, message: 'This tweak\u2019s confirmation flow is ready, but the underlying system change is still pending a safety review before release.' };
    },
    async revert() {
      return { success: false, message: 'Nothing was changed, so there is nothing to revert.' };
    },
  };
}

/** Builds a disabled placeholder tweak for spec items with no single verified-
 *  correct implementation across Windows builds — shown honestly, never faked. */
function unsupportedTweak(meta: Omit<TweakMeta, 'reversible'> & { reason: string }): TweakImpl {
  const { reason, ...rest } = meta;
  return {
    ...rest,
    reversible: false,
    unsupportedReason: reason,
    async detect() {
      return 'unsupported';
    },
    async apply() {
      return { success: false, message: reason };
    },
    async revert() {
      return { success: false, message: reason };
    },
  };
}

/** Snapshot the current value of a reg key before changing it, for revert(). */
async function backupThenSet(id: string, pathArg: string, name: string, newValue: string | number, type: 'DWord' | 'String'): Promise<OperationResult> {
  const original = await getRegValue(pathArg, name);
  await writeBackupBlob(id, { path: pathArg, name, type, original });
  return setRegValue(pathArg, name, newValue, type);
}

async function restoreFromBackup(id: string, pathArg: string, name: string, type: 'DWord' | 'String', fallback: string | number): Promise<OperationResult> {
  const state = await readState();
  const blob = state.backups?.[id] as { original: string | null } | undefined;
  if (blob && blob.original !== null && blob.original !== undefined) {
    return setRegValue(pathArg, name, blob.original, type);
  }
  return setRegValue(pathArg, name, fallback, type);
}

/** Like restoreFromBackup, but for values that don't exist by default on a
 *  stock system — reverting removes the key instead of guessing a fallback
 *  number, which more accurately restores "Windows' own default behavior". */
async function restoreOrRemoveFromBackup(id: string, pathArg: string, name: string, type: 'DWord' | 'String'): Promise<OperationResult> {
  const state = await readState();
  const blob = state.backups?.[id] as { original: string | null } | undefined;
  if (blob && blob.original !== null && blob.original !== undefined) {
    return setRegValue(pathArg, name, blob.original, type);
  }
  const res = await runPowerShell(`Remove-ItemProperty -Path '${pathArg}' -Name '${name}' -ErrorAction SilentlyContinue; Write-Output 'OK'`);
  return res.success
    ? { success: true, message: 'Registry value removed — restored to Windows\u2019 default behavior.' }
    : { success: false, message: 'Failed to remove registry value.', error: res.stderr || res.stdout };
}

/** Reads the current AC-power value of a documented powercfg alias setting
 *  (returns the decimal index, or null if it can't be parsed). */
async function getPowercfgValue(subgroup: string, setting: string): Promise<number | null> {
  const script = `
    $out = powercfg /q SCHEME_CURRENT ${subgroup} ${setting}
    $line = $out | Select-String 'Current AC Power Setting Index:'
    if ($line) { ($line -split ':')[1].Trim() } else { '__MISSING__' }
  `;
  const res = await runPowerShell(script, 8000);
  const raw = res.stdout.trim();
  if (!res.success || raw === '__MISSING__' || raw === '') return null;
  const parsed = parseInt(raw, 16) || parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Sets a documented powercfg alias setting for both AC and DC, then activates the scheme. */
async function setPowercfgValue(subgroup: string, setting: string, value: number): Promise<OperationResult> {
  const script = `
    powercfg /setacvalueindex SCHEME_CURRENT ${subgroup} ${setting} ${value}
    powercfg /setdcvalueindex SCHEME_CURRENT ${subgroup} ${setting} ${value}
    powercfg /setactive SCHEME_CURRENT
    Write-Output 'OK'
  `;
  const res = await runPowerShell(script, 10000);
  return res.success
    ? { success: true, message: 'Power setting updated.' }
    : { success: false, message: 'Failed to update power setting.', error: res.stderr || res.stdout };
}

export const tweaks: TweakImpl[] = [
  // --------------------------------------------------------------- GENERAL
  // Every value below is a documented, real Windows registry key or service —
  // no invented paths. Items from the spec without a single verified-correct
  // toggle across builds are listed separately as `unsupportedGeneralTweaks`.
  {
    id: 'disable-notifications',
    name: 'Disable All Notifications',
    description: 'Turns off Windows toast notifications and Action Center pop-ups.',
    category: 'general',
    subcategory: 'core',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications', 'ToastEnabled');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-notifications', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications', 'ToastEnabled', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-notifications', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications', 'ToastEnabled', 'DWord', 1);
    },
  },
  {
    id: 'disable-transparency',
    name: 'Disable Transparency Effects',
    description: 'Turns off the frosted-glass transparency used in the taskbar and Start menu.',
    category: 'general',
    subcategory: 'core',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-transparency', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-transparency', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', 'DWord', 1);
    },
  },
  {
    id: 'disable-animations',
    name: 'Disable Animations',
    description: 'Turns off window minimize/maximize and taskbar animations for a snappier feel.',
    category: 'general',
    subcategory: 'core',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Control Panel\\Desktop\\WindowMetrics', 'MinAnimate');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      const originalMinAnimate = await getRegValue('HKCU:\\Control Panel\\Desktop\\WindowMetrics', 'MinAnimate');
      const originalTaskbarAnim = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', 'TaskbarAnimations');
      await writeBackupBlob('disable-animations', { originalMinAnimate, originalTaskbarAnim });
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '0'
        New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarAnimations' -Value 0 -PropertyType DWord -Force | Out-Null
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success
        ? { success: true, message: 'Animations disabled. Sign out or restart Explorer to see the full effect.' }
        : { success: false, message: 'Could not disable animations.', error: res.stderr };
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['disable-animations'] as { originalMinAnimate: string | null; originalTaskbarAnim: string | null } | undefined;
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '${blob?.originalMinAnimate ?? '1'}'
        New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'TaskbarAnimations' -Value ${blob?.originalTaskbarAnim ?? '1'} -PropertyType DWord -Force | Out-Null
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success
        ? { success: true, message: 'Animations restored.' }
        : { success: false, message: 'Could not restore animations.', error: res.stderr };
    },
  },
  {
    id: 'disable-ceip',
    name: 'Disable Customer Experience Improvement Program',
    description: 'Stops Windows from sending usage statistics via the CEIP.',
    category: 'general',
    subcategory: 'core',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SOFTWARE\\Policies\\Microsoft\\SQMClient\\Windows', 'CEIPEnable');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      const res1 = await backupThenSet('disable-ceip', 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\SQMClient\\Windows', 'CEIPEnable', 0, 'DWord');
      await runPowerShell(`
        schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator" /Disable
        schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip" /Disable
      `);
      return res1;
    },
    async revert() {
      const res1 = await restoreFromBackup('disable-ceip', 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\SQMClient\\Windows', 'CEIPEnable', 'DWord', 1);
      await runPowerShell(`
        schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator" /Enable
        schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip" /Enable
      `);
      return res1;
    },
  },
  {
    id: 'disable-search-indexing',
    name: 'Disable Search Indexing',
    description: 'Stops and disables the Windows Search (WSearch) service to reduce background disk activity.',
    longDescription: 'Search indexing makes Start menu and File Explorer search fast. Disabling it saves background CPU/disk usage but searches will be slower, especially on large drives.',
    category: 'general',
    subcategory: 'core',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    async detect() {
      const v = await getServiceStartMode('WSearch');
      if (v === null) return 'unknown';
      return v === 'Disabled' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSetService('disable-search-indexing', 'WSearch', 'Disabled');
    },
    async revert() {
      return restoreServiceFromBackup('disable-search-indexing', 'WSearch');
    },
  },
  {
    id: 'disable-sysmain',
    name: 'Disable SysMain (Superfetch)',
    description: 'Disables the background service that preloads apps into RAM. Recommended on SSD-only systems.',
    longDescription: 'SysMain (formerly Superfetch) can cause unnecessary disk I/O, particularly on systems with fast SSDs where preloading provides little benefit. Some HDD-based systems may see slower cold app launches after disabling it.',
    category: 'general',
    subcategory: 'core',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    async detect() {
      const v = await getServiceStartMode('SysMain');
      if (v === null) return 'unknown';
      return v === 'Disabled' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSetService('disable-sysmain', 'SysMain', 'Disabled');
    },
    async revert() {
      return restoreServiceFromBackup('disable-sysmain', 'SysMain');
    },
  },
  {
    id: 'disable-startup-delay',
    name: 'Disable Startup App Delay',
    description: 'Removes the artificial delay Windows adds before launching startup apps.',
    category: 'general',
    subcategory: 'qol',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize', 'StartupDelayInMSec');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-startup-delay', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize', 'StartupDelayInMSec', 0, 'DWord');
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['disable-startup-delay'] as { original: string | null } | undefined;
      if (blob?.original) return setRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize', 'StartupDelayInMSec', blob.original, 'DWord');
      const res = await runPowerShell(`Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' -Name 'StartupDelayInMSec' -ErrorAction SilentlyContinue; Write-Output 'OK'`);
      return res.success ? { success: true, message: 'Startup delay restored to Windows default.' } : { success: false, message: 'Could not restore startup delay.' };
    },
  },
  {
    id: 'optimize-windows-search',
    name: 'Optimize Windows Search',
    description: 'Removes Bing web results and Cortana integration from Start menu search, keeping it local-only.',
    category: 'general',
    subcategory: 'qol',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('optimize-windows-search', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('optimize-windows-search', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 'DWord', 1);
    },
  },
  {
    id: 'enable-game-mode',
    name: 'Enable Windows Game Mode',
    description: 'Turns on Windows Game Mode so the OS deprioritizes background tasks in favor of the foreground game.',
    category: 'general',
    subcategory: 'apps',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled');
      if (v === null) return 'unknown';
      return v === '1' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('enable-game-mode', 'HKCU:\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1, 'DWord');
    },
    async revert() {
      return restoreFromBackup('enable-game-mode', 'HKCU:\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 'DWord', 0);
    },
  },
  {
    id: 'processor-scheduling-foreground',
    name: 'Optimize Processor Scheduling for Foreground Apps',
    description: 'Gives the app you\u2019re actively using longer CPU time slices instead of splitting evenly with background services.',
    longDescription: 'Sets Win32PrioritySeparation to prioritize short, variable quantums for the foreground application. This is the same effect as choosing "Programs" instead of "Background services" in Windows\u2019 Advanced Performance Options.',
    category: 'general',
    subcategory: 'powerplan',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl', 'Win32PrioritySeparation');
      if (v === null) return 'unknown';
      return v === '26' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('processor-scheduling-foreground', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl', 'Win32PrioritySeparation', 26, 'DWord');
    },
    async revert() {
      return restoreFromBackup('processor-scheduling-foreground', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl', 'Win32PrioritySeparation', 'DWord', 2);
    },
  },
  {
    id: 'disable-hibernation',
    name: 'Disable Hibernation',
    description: 'Turns off hibernation and deletes hiberfil.sys, freeing disk space equal to your installed RAM.',
    category: 'general',
    subcategory: 'powerplan',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power', 'HibernateEnabled');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell('powercfg /hibernate off');
      return res.success ? { success: true, message: 'Hibernation disabled; hiberfil.sys removed.' } : { success: false, message: 'Could not disable hibernation.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell('powercfg /hibernate on');
      return res.success ? { success: true, message: 'Hibernation re-enabled.' } : { success: false, message: 'Could not re-enable hibernation.', error: res.stderr };
    },
  },
  {
    id: 'disable-storage-sense',
    name: 'Disable Storage Sense',
    description: 'Stops Windows from automatically deleting temporary files and emptying Recycle Bin on a schedule.',
    category: 'general',
    subcategory: 'qol',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', '01');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-storage-sense', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', '01', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-storage-sense', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', '01', 'DWord', 1);
    },
  },
  {
    id: 'disable-windows-copilot',
    name: 'Disable Windows Copilot',
    description: 'Hides and disables the Windows Copilot button and background service.',
    category: 'general',
    subcategory: 'privacy',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot', 'TurnOffWindowsCopilot');
      if (v === null) return 'unknown';
      return v === '1' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-windows-copilot', 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot', 'TurnOffWindowsCopilot', 1, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-windows-copilot', 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot', 'TurnOffWindowsCopilot', 'DWord', 0);
    },
  },
  {
    id: 'disable-first-logon-animation',
    name: 'Disable First Sign-in Animation',
    description: 'Skips the "Hi" welcome animation shown the first time a user signs in.',
    category: 'general',
    subcategory: 'core',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI', 'EnableFirstLogonAnimation');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-first-logon-animation', 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI', 'EnableFirstLogonAnimation', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-first-logon-animation', 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI', 'EnableFirstLogonAnimation', 'DWord', 1);
    },
  },
  {
    id: 'disable-reserved-storage',
    name: 'Disable Reserved Storage',
    description: 'Frees the ~7GB of disk space Windows sets aside for its own updates and temp files.',
    longDescription: 'Reserved Storage helps keep updates and temp files from filling your disk completely, at the cost of that space always being unavailable to you. Disabling it returns the space but Windows updates may occasionally use more free space than usual.',
    category: 'general',
    subcategory: 'qol',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const res = await runPowerShell('(Get-WindowsReservedStorageState -ErrorAction SilentlyContinue).ReservedStorageState');
      if (!res.success || !res.stdout) return 'unknown';
      return /Disabled/i.test(res.stdout) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell('dism /Online /Set-ReservedStorageState /State:Disabled');
      return res.success ? { success: true, message: 'Reserved Storage disabled. Restart to reclaim the space.' } : { success: false, message: 'Could not disable Reserved Storage.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell('dism /Online /Set-ReservedStorageState /State:Enabled');
      return res.success ? { success: true, message: 'Reserved Storage re-enabled.' } : { success: false, message: 'Could not re-enable Reserved Storage.', error: res.stderr };
    },
  },
  {
    id: 'optimize-hung-applications',
    name: 'Optimize Hung Application Handling',
    description: 'Shortens how long Windows waits before treating an unresponsive app as hung, so it can recover or be closed faster.',
    category: 'general',
    subcategory: 'qol',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Control Panel\\Desktop', 'HungAppTimeout');
      if (v === null) return 'unknown';
      return v === '1000' ? 'applied' : 'not-applied';
    },
    async apply() {
      const originalHung = await getRegValue('HKCU:\\Control Panel\\Desktop', 'HungAppTimeout');
      const originalWait = await getRegValue('HKCU:\\Control Panel\\Desktop', 'WaitToKillAppTimeout');
      await writeBackupBlob('optimize-hung-applications', { originalHung, originalWait });
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '1000'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '2000'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success ? { success: true, message: 'Hung app timeouts shortened.' } : { success: false, message: 'Could not update timeouts.', error: res.stderr };
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['optimize-hung-applications'] as { originalHung: string | null; originalWait: string | null } | undefined;
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'HungAppTimeout' -Value '${blob?.originalHung ?? '5000'}'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name 'WaitToKillAppTimeout' -Value '${blob?.originalWait ?? '20000'}'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success ? { success: true, message: 'Timeouts restored to Windows defaults.' } : { success: false, message: 'Could not restore timeouts.', error: res.stderr };
    },
  },
  unsupportedTweak({
    id: 'disable-click-to-do',
    name: 'Disable Click to Do',
    description: 'Requested but not yet implemented.',
    category: 'general',
    subcategory: 'core',
    isNew: true,
    risk: 'low',
    requiresAdmin: false,
    reason: 'Click to Do is a Copilot+ PC feature with no stable, documented per-machine registry toggle yet. Marked unsupported rather than guess at a key.',
  }),
  unsupportedTweak({
    id: 'disable-cocreator',
    name: 'Disable Cocreator',
    description: 'Requested but not yet implemented.',
    category: 'general',
    subcategory: 'privacy',
    isNew: true,
    risk: 'low',
    requiresAdmin: false,
    reason: 'Cocreator (Paint AI) has no verified, stable registry key documented for a clean disable across builds. Marked unsupported rather than guess at a key.',
  }),
  unsupportedTweak({
    id: 'disable-inking',
    name: 'Disable Inking',
    description: 'Requested but not yet implemented.',
    category: 'general',
    subcategory: 'core',
    isNew: true,
    risk: 'low',
    requiresAdmin: false,
    reason: 'Windows Ink spans several overlapping subsystems (TabTip, pen flicks, ink workspace) with no single reliable switch. Needs per-subsystem verification before shipping.',
  }),
  unsupportedTweak({
    id: 'disable-speech-recognition',
    name: 'Disable Speech Recognition',
    description: 'Requested but not yet implemented.',
    category: 'general',
    subcategory: 'core',
    isNew: true,
    risk: 'low',
    requiresAdmin: false,
    reason: 'Legacy and online speech recognition use separate, partially undocumented settings that vary by Windows build. Needs verification before shipping a real toggle.',
  }),
  unsupportedTweak({
    id: 'disable-experimental-features',
    name: 'Disable Experimental Windows Features',
    description: 'Requested but not yet implemented.',
    category: 'general',
    subcategory: 'core',
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Experimental features are controlled via ViVeTool feature-flag IDs that change every Insider build — there is no single stable "off" switch to implement safely.',
  }),

  // --------------------------------------------------------------- HARDWARE
  {
    id: 'disable-mouse-acceleration',
    name: 'Disable Mouse Acceleration',
    description: 'Sets raw 1:1 mouse input by removing Windows pointer enhancement curves.',
    category: 'hardware',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const t = await getRegValue('HKCU:\\Control Panel\\Mouse', 'MouseSpeed');
      if (t === null) return 'unknown';
      return t === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value '0'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value '0'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value '0'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success
        ? { success: true, message: 'Mouse acceleration disabled.' }
        : { success: false, message: 'Could not disable mouse acceleration.', error: res.stderr };
    },
    async revert() {
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value '1'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value '6'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value '10'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success
        ? { success: true, message: 'Mouse acceleration restored to Windows defaults.' }
        : { success: false, message: 'Could not restore mouse settings.', error: res.stderr };
    },
  },
  {
    id: 'disable-game-dvr',
    name: 'Disable Game DVR & Xbox Game Bar Capture',
    description: 'Turns off background game recording that can cause stutter and overhead in games.',
    category: 'hardware',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\System\\GameConfigStore', 'GameDVR_Enabled');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-game-dvr', 'HKCU:\\System\\GameConfigStore', 'GameDVR_Enabled', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-game-dvr', 'HKCU:\\System\\GameConfigStore', 'GameDVR_Enabled', 'DWord', 1);
    },
  },
  {
    id: 'enable-hags',
    name: 'Enable Hardware-Accelerated GPU Scheduling',
    description: 'Lets the GPU manage its own memory queue, reducing input latency on supported hardware.',
    category: 'hardware',
    tier: 'premium',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode');
      if (v === null) return 'unknown';
      return v === '2' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('enable-hags', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 2, 'DWord');
    },
    async revert() {
      return restoreFromBackup('enable-hags', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 'DWord', 1);
    },
  },

  {
    id: 'high-performance-power-plan',
    name: 'Switch to High Performance Power Plan',
    description: 'Activates the Windows High Performance power scheme instead of Balanced.',
    category: 'hardware',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell('powercfg /getactivescheme');
      if (!res.success) return 'unknown';
      return /High performance/i.test(res.stdout) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell('powercfg /setactive SCHEME_MIN');
      return res.success
        ? { success: true, message: 'High Performance power plan activated.' }
        : { success: false, message: 'Could not switch power plan.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell('powercfg /setactive SCHEME_BALANCED');
      return res.success
        ? { success: true, message: 'Balanced power plan restored.' }
        : { success: false, message: 'Could not restore power plan.', error: res.stderr };
    },
  },
  {
    id: 'best-performance-visual-effects',
    name: 'Optimize Visual Effects for Performance',
    description: 'Reduces window animations and transparency effects for a snappier UI.',
    category: 'general',
    subcategory: 'powerplan',
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting');
      if (v === null) return 'unknown';
      return v === '2' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet(
        'best-performance-visual-effects',
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
        'VisualFXSetting',
        2,
        'DWord'
      );
    },
    async revert() {
      return restoreFromBackup(
        'best-performance-visual-effects',
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
        'VisualFXSetting',
        'DWord',
        0
      );
    },
  },

  // ---------------------------------------------------- HARDWARE: CPU
  {
    id: 'disable-cpu-power-throttling',
    name: 'Disable Power Throttling',
    description: 'Stops Windows from deliberately slowing down background apps to save power.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling', 'PowerThrottlingOff');
      if (v === null) return 'unknown';
      return v === '1' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-cpu-power-throttling', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling', 'PowerThrottlingOff', 1, 'DWord');
    },
    async revert() {
      return restoreOrRemoveFromBackup('disable-cpu-power-throttling', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling', 'PowerThrottlingOff', 'DWord');
    },
  },
  {
    id: 'set-kernel-worker-threads',
    name: 'Increase Kernel Worker Threads',
    description: 'Raises the number of additional critical/delayed kernel worker threads available to the system.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Executive', 'AdditionalCriticalWorkerThreads');
      if (v === null) return 'unknown';
      return v === '6' ? 'applied' : 'not-applied';
    },
    async apply() {
      const a = await backupThenSet('set-kernel-worker-threads', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Executive', 'AdditionalCriticalWorkerThreads', 6, 'DWord');
      const b = await backupThenSet('set-kernel-worker-threads-delayed', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Executive', 'AdditionalDelayedWorkerThreads', 6, 'DWord');
      return a.success && b.success ? { success: true, message: 'Kernel worker thread counts increased.' } : { success: false, message: 'Could not update one or both values.', error: a.error || b.error };
    },
    async revert() {
      const a = await restoreOrRemoveFromBackup('set-kernel-worker-threads', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Executive', 'AdditionalCriticalWorkerThreads', 'DWord');
      const b = await restoreOrRemoveFromBackup('set-kernel-worker-threads-delayed', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Executive', 'AdditionalDelayedWorkerThreads', 'DWord');
      return a.success && b.success ? { success: true, message: 'Restored to Windows\u2019 default worker thread counts.' } : { success: false, message: 'Could not restore one or both values.', error: a.error || b.error };
    },
  },
  {
    id: 'set-max-processor-state-100',
    name: 'Set Minimum & Maximum Processor State to 100%',
    description: 'Stops the CPU from clocking down at idle by locking the active power plan\u2019s min and max processor state to 100%.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    async detect() {
      const min = await getPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMIN');
      const max = await getPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMAX');
      if (min === null || max === null) return 'unknown';
      return min === 100 && max === 100 ? 'applied' : 'not-applied';
    },
    async apply() {
      const min = await getPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMIN');
      const max = await getPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMAX');
      await writeBackupBlob('set-max-processor-state-100', { min, max });
      const a = await setPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMIN', 100);
      const b = await setPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMAX', 100);
      return a.success && b.success
        ? { success: true, message: 'Processor state locked to 100%. Note: this keeps the CPU running hot/loud at idle — pair with a fan curve you\u2019re comfortable with.' }
        : { success: false, message: 'Could not update processor power settings.', error: a.error || b.error };
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['set-max-processor-state-100'] as { min: number | null; max: number | null } | undefined;
      const min = blob?.min ?? 5;
      const max = blob?.max ?? 100;
      const a = await setPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMIN', min);
      const b = await setPowercfgValue('SUB_PROCESSOR', 'PROCTHROTTLEMAX', max);
      return a.success && b.success ? { success: true, message: 'Processor power state restored.' } : { success: false, message: 'Could not restore processor power settings.', error: a.error || b.error };
    },
  },
  unsupportedTweak({
    id: 'disable-c-states',
    name: 'Disable Basic C-States',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Deep C-state control lives in BIOS/UEFI on most modern boards, not a Windows-side toggle Frontier Tweaks can safely flip \u2014 the OS-side "C1E"/idle settings that do exist vary by chipset driver.',
  }),
  unsupportedTweak({
    id: 'energy-performance-preference',
    name: 'Prefer Performance Over Energy Savings',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    risk: 'low',
    requiresAdmin: true,
    reason: 'The Energy Performance Preference power setting uses a scheme-specific GUID rather than a documented powercfg alias, so it needs to be read per-system with `powercfg /q` before Frontier Tweaks can set it reliably.',
  }),
  unsupportedTweak({
    id: 'disable-modern-standby',
    name: 'Disable Modern Standby',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Modern Standby is enabled at the firmware/ACPI level on most OEM devices \u2014 there\u2019s no registry toggle that reliably reverts a device to S3 sleep across hardware.',
  }),
  unsupportedTweak({
    id: 'set-scheduling-reserve',
    name: 'Set CPU Scheduling Reserve',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'No single documented, verified registry key controls this across current Windows builds \u2014 needs more research before shipping a real toggle.',
  }),
  unsupportedTweak({
    id: 'disable-event-processor',
    name: 'Disable Event-Driven Processor Adjustments',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Needs the exact processor performance event-notification setting verified against a real machine before Frontier Tweaks ships a command for it.',
  }),

  // ---------------------------------------------------- HARDWARE: RAM
  {
    id: 'disable-prefetcher',
    name: 'Disable Prefetcher',
    description: 'Stops Windows from pre-loading commonly used app data into RAM on startup. Mainly useful on systems with an SSD.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters', 'EnablePrefetcher');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-prefetcher', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters', 'EnablePrefetcher', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-prefetcher', 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters', 'EnablePrefetcher', 'DWord', 3);
    },
  },
  {
    id: 'enable-superfetch',
    name: 'Enable SysMain (Superfetch)',
    description: 'Turns on the SysMain service, which pre-loads frequently used apps into RAM. Conflicts with "Disable SysMain" in General \u2014 only one of the two makes sense at a time.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getServiceStartMode('SysMain');
      if (v === null) return 'unknown';
      return v === 'Auto' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSetService('enable-superfetch', 'SysMain', 'Automatic');
    },
    async revert() {
      return restoreServiceFromBackup('enable-superfetch', 'SysMain');
    },
  },
  {
    id: 'disable-page-combining',
    name: 'Disable Memory Page Combining',
    description: 'Stops Windows from merging identical memory pages across processes \u2014 trades some RAM usage for slightly lower CPU overhead.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell(`(Get-MMAgent).PageCombining`, 8000);
      if (!res.success) return 'unknown';
      return res.stdout.trim() === 'False' ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell(`Disable-MMAgent -PageCombining; Write-Output 'OK'`, 8000);
      return res.success ? { success: true, message: 'Page combining disabled.' } : { success: false, message: 'Could not disable page combining.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell(`Enable-MMAgent -PageCombining; Write-Output 'OK'`, 8000);
      return res.success ? { success: true, message: 'Page combining re-enabled.' } : { success: false, message: 'Could not re-enable page combining.', error: res.stderr };
    },
  },
  {
    id: 'disable-memory-diagnostics-task',
    name: 'Disable Memory Diagnostic Scheduled Task',
    description: 'Stops Windows from automatically scheduling a memory diagnostic test after a crash.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell(`(Get-ScheduledTask -TaskPath '\\Microsoft\\Windows\\MemoryDiagnostic\\' -TaskName 'RunFullMemoryDiagnostic' -ErrorAction SilentlyContinue).State`, 8000);
      if (!res.success || !res.stdout.trim()) return 'unknown';
      return res.stdout.trim() === 'Disabled' ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell(`Disable-ScheduledTask -TaskPath '\\Microsoft\\Windows\\MemoryDiagnostic\\' -TaskName 'RunFullMemoryDiagnostic' -ErrorAction Stop; Write-Output 'OK'`, 8000);
      return res.success ? { success: true, message: 'Memory diagnostic task disabled.' } : { success: false, message: 'Could not disable the scheduled task.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell(`Enable-ScheduledTask -TaskPath '\\Microsoft\\Windows\\MemoryDiagnostic\\' -TaskName 'RunFullMemoryDiagnostic' -ErrorAction Stop; Write-Output 'OK'`, 8000);
      return res.success ? { success: true, message: 'Memory diagnostic task re-enabled.' } : { success: false, message: 'Could not re-enable the scheduled task.', error: res.stderr };
    },
  },

  // ------------------------------------------------ HARDWARE: STORAGE
  {
    id: 'disable-storage-idle-timeout',
    name: 'Disable Storage Idle Timeout',
    description: 'Stops Windows from spinning down/parking drives after a period of inactivity.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getPowercfgValue('SUB_DISK', 'DISKIDLE');
      if (v === null) return 'unknown';
      return v === 0 ? 'applied' : 'not-applied';
    },
    async apply() {
      const current = await getPowercfgValue('SUB_DISK', 'DISKIDLE');
      await writeBackupBlob('disable-storage-idle-timeout', { value: current });
      return setPowercfgValue('SUB_DISK', 'DISKIDLE', 0);
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['disable-storage-idle-timeout'] as { value: number | null } | undefined;
      return setPowercfgValue('SUB_DISK', 'DISKIDLE', blob?.value ?? 20);
    },
  },
  {
    id: 'optimize-drives-trim',
    name: 'Optimize Drives (Full TRIM Pass)',
    description: 'Runs a one-time TRIM/retrim pass across all fixed drives to keep SSD write performance healthy. This is an action, not a persistent setting.',
    category: 'hardware',
    tier: 'premium',
    isNew: true,
    reversible: false,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        $ErrorActionPreference = 'SilentlyContinue'
        Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object {
          Optimize-Volume -DriveLetter $_.DriveLetter -ReTrim -ErrorAction SilentlyContinue
        }
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 120000);
      return res.success ? { success: true, message: 'TRIM pass complete on all fixed drives.' } : { success: false, message: 'Some drives could not be optimized.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  unsupportedTweak({
    id: 'disable-hipm-dipm-parking',
    name: 'Disable HIPM/DIPM Link Power Management',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'AHCI Link Power Management uses a driver-specific power-setting GUID with no documented powercfg alias \u2014 needs the exact GUID confirmed per storage controller before shipping a command.',
  }),
  unsupportedTweak({
    id: 'disable-write-cache-buffer-flushing',
    name: 'Disable Write-Cache Buffer Flushing',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'high',
    requiresAdmin: true,
    reason: 'This trades data-loss safety on power failure for a small write-latency gain \u2014 needs a very deliberate, clearly-labeled implementation (per-disk, not global) before shipping, not a blanket toggle.',
  }),
  unsupportedTweak({
    id: 'apply-ssd-ntfs-tweaks',
    name: 'Apply SSD-Specific NTFS Tweaks',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Needs to auto-detect SSD vs HDD per volume (fsutil behavior host) before touching filesystem tweaks like last-access-timestamp updates, to avoid applying SSD-oriented settings to a spinning disk.',
  }),
  unsupportedTweak({
    id: 'disable-ssd-powersaving',
    name: 'Disable SSD Power Saving',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'NVMe APST/power-state settings are exposed differently per controller/driver \u2014 needs verification against real NVMe hardware before shipping a single toggle.',
  }),
  unsupportedTweak({
    id: 'disable-low-latency-cap',
    name: 'Disable Low Latency Cap',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Not a documented, verifiable Windows storage setting under this name \u2014 needs the specific vendor tool/registry key identified before Frontier Tweaks can implement it honestly.',
  }),

  // -------------------------------------------- HARDWARE: PERIPHERALS (KBM)
  {
    id: 'disable-usb-selective-suspend',
    name: 'Disable USB Selective Suspend',
    description: 'Stops Windows from power-managing USB devices (mice, keyboards, controllers) into a low-power idle state.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getPowercfgValue('2a737441-1930-4402-8d77-b2bebba308a3', '48e6b7a6-50f5-4782-a5d4-53bb8f07e226');
      if (v === null) return 'unknown';
      return v === 0 ? 'applied' : 'not-applied';
    },
    async apply() {
      const current = await getPowercfgValue('2a737441-1930-4402-8d77-b2bebba308a3', '48e6b7a6-50f5-4782-a5d4-53bb8f07e226');
      await writeBackupBlob('disable-usb-selective-suspend', { value: current });
      return setPowercfgValue('2a737441-1930-4402-8d77-b2bebba308a3', '48e6b7a6-50f5-4782-a5d4-53bb8f07e226', 0);
    },
    async revert() {
      const state = await readState();
      const blob = state.backups?.['disable-usb-selective-suspend'] as { value: number | null } | undefined;
      return setPowercfgValue('2a737441-1930-4402-8d77-b2bebba308a3', '48e6b7a6-50f5-4782-a5d4-53bb8f07e226', blob?.value ?? 1);
    },
  },
  {
    id: 'reduce-keyboard-repeat-delay',
    name: 'Reduce Keyboard Repeat Delay',
    description: 'Sets the shortest keyboard repeat delay and fastest repeat rate Windows exposes.',
    category: 'hardware',
    isNew: true,
    reversible: true,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      const v = await getRegValue('HKCU:\\Control Panel\\Keyboard', 'KeyboardDelay');
      if (v === null) return 'unknown';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Keyboard' -Name 'KeyboardDelay' -Value '0'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Keyboard' -Name 'KeyboardSpeed' -Value '31'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success ? { success: true, message: 'Keyboard repeat delay reduced.' } : { success: false, message: 'Could not update keyboard settings.', error: res.stderr };
    },
    async revert() {
      const script = `
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Keyboard' -Name 'KeyboardDelay' -Value '1'
        Set-ItemProperty -Path 'HKCU:\\Control Panel\\Keyboard' -Name 'KeyboardSpeed' -Value '31'
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script);
      return res.success ? { success: true, message: 'Default keyboard repeat delay restored.' } : { success: false, message: 'Could not restore keyboard settings.', error: res.stderr };
    },
  },
  unsupportedTweak({
    id: 'disable-hidden-usb-power-saving',
    name: 'Disable All Hidden USB Power-Saving Features',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'low',
    requiresAdmin: true,
    reason: 'Per-device "Allow the computer to turn off this device to save power" flags live on each individual USB Hub/Root Hub device instance, not one global switch \u2014 needs a device-enumeration pass (like the planned Devices tab) rather than a single tweak.',
  }),

  // ------------------------------------------------- HARDWARE: NVIDIA GPU
  // Every NVIDIA-specific item from the spec (ELPG, GC5/GC6 caching, ASPM,
  // DMA remapping, engine clocks, PCI latency timer, watchdog, perf limits,
  // etc.) touches undocumented, driver-version-specific registry values
  // under nvlddmkm\\Parameters. There is no single verified-correct value
  // set across driver branches, and getting one wrong risks driver crashes
  // or a black screen \u2014 so these ship as honest placeholders rather than
  // guessed registry writes. NVIDIA App / GeForce Experience already expose
  // the safe subset of this (driver update opt-out, HDCP, GPU scheduling).
  unsupportedTweak({
    id: 'nvidia-driver-tuning-suite',
    name: 'NVIDIA Driver-Level Tuning (GeForce Driver Update, HDCP, ELPG, ASPM, DMA Remapping, Engine Clocks & more)',
    description: 'Requested but not yet implemented.',
    category: 'hardware',
    isNew: true,
    risk: 'high',
    requiresAdmin: true,
    reason: 'These map to undocumented nvlddmkm registry parameters that change between driver branches \u2014 a wrong value here can cause driver crashes or a black screen. Needs per-driver-version verification (ideally with NVIDIA\u2019s own tooling) before Frontier Tweaks ships real commands. Enable HAGS and the GPU Profile card already cover the safely-documented part of GPU tuning.',
  }),

  // --------------------------------------------------------------- NETWORK
  {
    id: 'flush-dns',
    name: 'Flush DNS Cache',
    description: 'Clears the local DNS resolver cache. Not reversible because there is nothing to undo.',
    category: 'network',
    reversible: false,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const res = await runPowerShell('ipconfig /flushdns');
      return res.success
        ? { success: true, message: 'DNS cache flushed.' }
        : { success: false, message: 'Could not flush DNS cache.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'reset-winsock',
    name: 'Reset Winsock Catalog',
    description: 'Resets the network stack. This will briefly disconnect networking and may require a restart.',
    longDescription:
      'Winsock reset rebuilds the low-level networking catalog Windows uses for sockets. Useful after malware removal or persistent connectivity issues. Your network will drop briefly while this runs.',
    category: 'network',
    reversible: false,
    risk: 'medium',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const res = await runPowerShell('netsh winsock reset');
      return res.success
        ? { success: true, message: 'Winsock reset. A restart is recommended.' }
        : { success: false, message: 'Could not reset Winsock.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'disable-ipv6',
    name: 'Disable IPv6',
    description: 'Disables IPv6 on all adapters system-wide. Useful on networks where IPv6 causes latency or routing issues.',
    category: 'network',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters', 'DisabledComponents');
      if (v === null) return 'not-applied';
      return v === '4294967295' || v === '0xffffffff' || parseInt(v, 10) === 0xff ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-ipv6', 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters', 'DisabledComponents', 255, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-ipv6', 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters', 'DisabledComponents', 'DWord', 0);
    },
  },
  {
    id: 'optimize-tcp-autotuning',
    name: 'Set TCP Window Auto-Tuning to Normal',
    description: 'Ensures Windows\u2019 TCP receive window auto-tuning is set to its default, most-compatible level.',
    longDescription: 'Some optimization guides recommend disabling auto-tuning entirely for lower latency, but this can reduce throughput on high-bandwidth connections. This tweak resets it to the documented Windows default ("normal") rather than an aggressive, unverified setting.',
    category: 'network',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell('(Get-NetTCPSetting -SettingName InternetCustom -ErrorAction SilentlyContinue).AutoTuningLevelLocal');
      if (!res.success || !res.stdout) return 'unknown';
      return /normal/i.test(res.stdout) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell('netsh int tcp set global autotuninglevel=normal');
      return res.success ? { success: true, message: 'TCP auto-tuning set to normal.' } : { success: false, message: 'Could not change auto-tuning.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell('netsh int tcp set global autotuninglevel=normal');
      return res.success ? { success: true, message: 'Left at Windows default (normal).' } : { success: false, message: 'Could not restore auto-tuning.', error: res.stderr };
    },
  },
  {
    id: 'disable-delivery-optimization',
    name: 'Disable Delivery Optimization',
    description: 'Stops Windows from uploading update/app data to other PCs on your network or the internet (peer-to-peer updates).',
    category: 'network',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const v = await getRegValue('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization', 'DODownloadMode');
      if (v === null) return 'not-applied';
      return v === '0' ? 'applied' : 'not-applied';
    },
    async apply() {
      return backupThenSet('disable-delivery-optimization', 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization', 'DODownloadMode', 0, 'DWord');
    },
    async revert() {
      return restoreFromBackup('disable-delivery-optimization', 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization', 'DODownloadMode', 'DWord', 1);
    },
  },
  {
    id: 'enable-network-discovery',
    name: 'Enable Network Discovery',
    description: 'Makes this PC visible to other devices on the local network and lets it see them (needed for LAN gaming/file sharing).',
    longDescription: 'This opens the Windows Firewall rule group "Network Discovery," which allows other devices on the same network to see and connect to this PC for file/printer sharing discovery. Only enable this on networks you trust (home/LAN) — never on public Wi-Fi.',
    category: 'network',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell(`(Get-NetFirewallRule -DisplayGroup 'Network Discovery' -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' } | Measure-Object).Count`);
      if (!res.success) return 'unknown';
      return parseInt(res.stdout.trim(), 10) > 0 ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell(`Set-NetFirewallRule -DisplayGroup 'Network Discovery' -Enabled True -ErrorAction Stop; Write-Output 'OK'`);
      return res.success ? { success: true, message: 'Network Discovery enabled.' } : { success: false, message: 'Could not enable Network Discovery.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell(`Set-NetFirewallRule -DisplayGroup 'Network Discovery' -Enabled False -ErrorAction Stop; Write-Output 'OK'`);
      return res.success ? { success: true, message: 'Network Discovery disabled.' } : { success: false, message: 'Could not disable Network Discovery.', error: res.stderr };
    },
  },
  unsupportedTweak({
    id: 'tcp-ack-frequency',
    name: 'TCP Packet Acknowledgment Optimization',
    description: 'Requested but not yet implemented.',
    category: 'network',
    risk: 'medium',
    requiresAdmin: true,
    reason: 'TcpAckFrequency is written per network-adapter registry GUID, which differs per machine and changes if the adapter is reinstalled. Needs real adapter enumeration and per-GUID targeting before shipping — not a blanket path.',
  }),
  unsupportedTweak({
    id: 'adapter-offload-tuning',
    name: 'Network Offload / Coalescing Configuration',
    description: 'Requested but not yet implemented.',
    category: 'network',
    risk: 'medium',
    requiresAdmin: true,
    reason: 'Offload and interrupt-coalescing settings are exposed through vendor-specific NIC driver properties with no standardized registry path across chipsets. Needs real per-adapter driver property enumeration before shipping.',
  }),
  unsupportedTweak({
    id: 'bufferbloat-presets',
    name: 'Bufferbloat Presets (Normal / Ultra Low)',
    description: 'Requested but not yet implemented.',
    category: 'network',
    risk: 'low',
    requiresAdmin: true,
    reason: 'Meaningful bufferbloat reduction depends on the router\u2019s queue management (fq_codel/CAKE), not just this PC, and there\u2019s no single Windows-side setting that reliably reproduces it. Needs a router-side story before this can honestly ship as a preset.',
  }),

  // ------------------------------------------------------------ CATEGORY: DEBLOAT
  {
    id: 'clear-temp-files',
    name: 'Clear Windows Temporary Files',
    description: 'Deletes files in the user and Windows Temp folders. Does not touch personal documents.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        $ErrorActionPreference = 'SilentlyContinue'
        Get-ChildItem -Path $env:TEMP -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 30000);
      return res.success
        ? { success: true, message: 'Temporary files cleared.' }
        : { success: false, message: 'Some temporary files could not be removed (in use).', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'empty-recycle-bin',
    name: 'Empty Recycle Bin',
    description: 'Permanently deletes all items currently in the Recycle Bin.',
    category: 'debloat',
    reversible: false,
    risk: 'medium',
    requiresAdmin: false,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const res = await runPowerShell('Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "OK"');
      return res.success
        ? { success: true, message: 'Recycle Bin emptied.' }
        : { success: false, message: 'Could not empty Recycle Bin.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'clear-prefetch',
    name: 'Clear Prefetch Files',
    description: 'Deletes cached Windows Prefetch data. Windows safely rebuilds this over time as you use apps.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const res = await runPowerShell(`Remove-Item -Path "$env:SystemRoot\\Prefetch\\*" -Force -Recurse -ErrorAction SilentlyContinue; Write-Output 'OK'`, 20000);
      return res.success
        ? { success: true, message: 'Prefetch cache cleared.' }
        : { success: false, message: 'Could not clear Prefetch folder.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'clear-windows-update-cache',
    name: 'Clear Windows Update Cache',
    description: 'Stops the Update service, clears downloaded update files, then restarts it. Fixes many stuck-update issues.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
        Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:SystemRoot\\SoftwareDistribution\\Download\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Start-Service -Name bits -ErrorAction SilentlyContinue
        Start-Service -Name wuauserv -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 25000);
      return res.success
        ? { success: true, message: 'Windows Update cache cleared.' }
        : { success: false, message: 'Could not clear the update cache.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'clear-crash-dumps-logs',
    name: 'Clear Crash Dumps & Error Reports',
    description: 'Deletes memory dump files and stored Windows Error Reporting queue/archive data.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        Remove-Item -Path "$env:SystemRoot\\Minidump\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:SystemRoot\\memory.dmp" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:ProgramData\\Microsoft\\Windows\\WER\\ReportQueue\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 20000);
      return res.success
        ? { success: true, message: 'Crash dumps and error reports cleared.' }
        : { success: false, message: 'Could not clear crash/error data.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'clear-icon-cache',
    name: 'Rebuild Icon & Thumbnail Cache',
    description: 'Clears corrupted icon/thumbnail cache files and restarts Explorer. Fixes blank or wrong icons.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:LocalAppData\\Microsoft\\Windows\\Explorer\\iconcache*" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:LocalAppData\\Microsoft\\Windows\\Explorer\\thumbcache*" -Force -ErrorAction SilentlyContinue
        Start-Process explorer.exe
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 20000);
      return res.success
        ? { success: true, message: 'Icon and thumbnail cache cleared; Explorer restarted.' }
        : { success: false, message: 'Could not clear the icon cache.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  {
    id: 'clear-browser-cache',
    name: 'Clear Browser Cache (Chrome & Edge)',
    description: 'Deletes cached site data for Google Chrome and Microsoft Edge. Bookmarks, passwords, and history are untouched.',
    longDescription: 'Close Chrome and Edge before running this for the most complete clean — files still open by a running browser will simply be skipped rather than causing a failure.',
    category: 'debloat',
    reversible: false,
    risk: 'low',
    requiresAdmin: false,
    async detect() {
      return 'unknown';
    },
    async apply() {
      const script = `
        Remove-Item -Path "$env:LocalAppData\\Google\\Chrome\\User Data\\Default\\Cache\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:LocalAppData\\Google\\Chrome\\User Data\\Default\\Code Cache\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:LocalAppData\\Microsoft\\Edge\\User Data\\Default\\Cache\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:LocalAppData\\Microsoft\\Edge\\User Data\\Default\\Code Cache\\*" -Force -Recurse -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `;
      const res = await runPowerShell(script, 25000);
      return res.success
        ? { success: true, message: 'Browser cache cleared for installed browsers.' }
        : { success: false, message: 'Could not clear browser cache.', error: res.stderr };
    },
    async revert() {
      return { success: false, message: 'This action is not reversible.' };
    },
  },
  unsupportedTweak({
    id: 'clear-installer-cache',
    name: 'Clear Installer/App Caches',
    description: 'Requested but not yet implemented.',
    category: 'debloat',
    risk: 'high',
    requiresAdmin: true,
    reason: 'The Windows Installer cache (C:\\Windows\\Installer) holds patch files many apps need to repair or uninstall cleanly. Blind deletion here is a well-known way to break future uninstalls — needs a verified per-product-code approach before shipping, not a blanket wipe.',
  }),

  // --------------------------------------------------------------- ADVANCED
  // Real, hardening-direction changes (documented, reversible via Set-ProcessMitigation
  // or DISM, not "weakening" so no danger banner needed):
  {
    id: 'enable-cfg',
    name: 'Control Flow Guard (Anti-ROP)',
    description: 'Turns on Control Flow Guard system-wide, a mitigation that makes ROP-style exploit chains much harder to execute.',
    category: 'advanced',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    longDescription: 'CFG is on by default for most modern signed binaries already; this enforces it as a system-wide policy. A very small number of older or unsigned apps may fail to launch — Undo restores default behavior.',
    async detect() {
      const res = await runPowerShell('(Get-ProcessMitigation -System).CFG.Enable');
      if (!res.success) return 'unknown';
      return /^ON$/i.test(res.stdout.trim()) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell("Set-ProcessMitigation -System -Enable CFG; Write-Output 'OK'");
      return res.success ? { success: true, message: 'Control Flow Guard enforced system-wide.' } : { success: false, message: 'Could not enable CFG.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell("Set-ProcessMitigation -System -Disable CFG; Write-Output 'OK'");
      return res.success ? { success: true, message: 'Reverted to default CFG policy.' } : { success: false, message: 'Could not revert CFG.', error: res.stderr };
    },
  },
  {
    id: 'enable-strict-handle-checks',
    name: 'Strict Handle Checks',
    description: 'Terminates a process immediately if it uses an invalid handle, catching a common exploit primitive early.',
    category: 'advanced',
    reversible: true,
    risk: 'low',
    requiresAdmin: true,
    async detect() {
      const res = await runPowerShell('(Get-ProcessMitigation -System).StrictHandle.Enable');
      if (!res.success) return 'unknown';
      return /^ON$/i.test(res.stdout.trim()) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell("Set-ProcessMitigation -System -Enable StrictHandle; Write-Output 'OK'");
      return res.success ? { success: true, message: 'Strict handle checks enabled system-wide.' } : { success: false, message: 'Could not enable strict handle checks.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell("Set-ProcessMitigation -System -Disable StrictHandle; Write-Output 'OK'");
      return res.success ? { success: true, message: 'Reverted to default policy.' } : { success: false, message: 'Could not revert.', error: res.stderr };
    },
  },
  {
    id: 'disable-smbv1',
    name: 'Disable SMBv1 Protocol',
    description: 'Removes the legacy, insecure SMBv1 file-sharing protocol (the one exploited by WannaCry).',
    longDescription: 'SMBv1 is decades old and disabled by default on modern Windows. Only revert this if you specifically need to connect to very old NAS devices or Windows XP/2003 machines that only speak SMBv1.',
    category: 'advanced',
    reversible: true,
    risk: 'medium',
    requiresAdmin: true,
    requiresRestart: true,
    async detect() {
      const res = await runPowerShell('(Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction SilentlyContinue).State');
      if (!res.success || !res.stdout) return 'unknown';
      return /Disabled/i.test(res.stdout) ? 'applied' : 'not-applied';
    },
    async apply() {
      const res = await runPowerShell("Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart -ErrorAction Stop; Write-Output 'OK'", 30000);
      return res.success ? { success: true, message: 'SMBv1 disabled. Restart to complete.' } : { success: false, message: 'Could not disable SMBv1.', error: res.stderr };
    },
    async revert() {
      const res = await runPowerShell("Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart -ErrorAction Stop; Write-Output 'OK'", 30000);
      return res.success ? { success: true, message: 'SMBv1 re-enabled. Restart to complete.' } : { success: false, message: 'Could not re-enable SMBv1.', error: res.stderr };
    },
  },

  // Genuinely dangerous, security-weakening items: UI + warning + confirmation
  // are fully built per your instruction; apply() is intentionally a no-op
  // until each gets a real, audited implementation.
  pendingDangerousTweak({
    id: 'disable-windows-defender',
    name: 'Disable Windows Defender',
    description: 'Turns off real-time protection entirely.',
    category: 'advanced',
    risk: 'high',
    requiresAdmin: true,
    warning: 'This leaves your PC with no active antivirus protection. Only do this if you have another antivirus installed, or fully understand the risk. Modern Windows also actively resists this via Tamper Protection.',
  }),
  pendingDangerousTweak({
    id: 'disable-core-isolation',
    name: 'Disable Core Isolation (Memory Integrity)',
    description: 'Turns off hypervisor-enforced code integrity (VBS/HVCI).',
    category: 'advanced',
    risk: 'high',
    requiresAdmin: true,
    warning: 'Memory Integrity blocks a whole class of driver-based exploits. Disabling it can improve compatibility/performance with some older anti-cheat or drivers, at the cost of that protection. Requires a restart either way.',
  }),
  pendingDangerousTweak({
    id: 'disable-uac',
    name: 'Disable User Account Control (UAC)',
    description: 'Stops Windows from prompting before apps make admin-level changes.',
    category: 'advanced',
    risk: 'high',
    requiresAdmin: true,
    warning: 'UAC is one of Windows\u2019 core defenses against malware silently gaining admin rights. Disabling it means any app can make system-level changes without asking. Not recommended.',
  }),
  pendingDangerousTweak({
    id: 'disable-smartscreen',
    name: 'Disable SmartScreen',
    description: 'Stops Windows from checking downloaded files/apps against Microsoft\u2019s reputation database.',
    category: 'advanced',
    risk: 'medium',
    requiresAdmin: false,
    warning: 'SmartScreen warns you before running unrecognized or known-malicious downloads. Disabling it removes that layer of protection entirely.',
  }),
  pendingDangerousTweak({
    id: 'disable-dynamic-code-restrictions',
    name: 'Disable Dynamic Code Restrictions',
    description: 'Allows processes to generate and execute code in memory at runtime, system-wide.',
    category: 'advanced',
    risk: 'high',
    requiresAdmin: true,
    warning: 'Blocking dynamic code generation stops a common exploit technique (JIT spraying). Disabling it system-wide can also break legitimate JIT-based software (browsers, some game engines) if left on by default — this reverses that protection entirely.',
  }),
  pendingDangerousTweak({
    id: 'disable-win32k-lockdown',
    name: 'Disable Win32k System-Call Restrictions',
    description: 'Removes the restriction that blocks legacy Win32k GUI system calls from less-trusted processes.',
    category: 'advanced',
    risk: 'high',
    requiresAdmin: true,
    warning: 'Win32k lockdown closes off a large, historically exploited attack surface. Disabling it system-wide meaningfully increases exposure to kernel-level exploits.',
  }),
  pendingDangerousTweak({
    id: 'disable-extension-point-isolation',
    name: 'Disable Extension Point Isolation',
    description: 'Allows third-party DLLs to inject into Windows shell/Explorer processes again via legacy extension points.',
    category: 'advanced',
    risk: 'medium',
    requiresAdmin: true,
    warning: 'Extension Point Isolation blocks a common DLL-injection technique used by malware to persist inside trusted processes. Only disable this if a specific legacy shell extension genuinely requires it.',
  }),
];

export function getTweakById(id: string): TweakImpl | undefined {
  return tweaks.find((t) => t.id === id);
}

export function tweaksAsMeta(): TweakMeta[] {
  return tweaks.map(({ detect, apply, revert, ...meta }) => meta);
}

export async function detectAllStatuses(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    tweaks.map(async (t) => {
      try {
        return [t.id, await t.detect()] as const;
      } catch (err) {
        logger.error('detect-failed', { id: t.id, error: String(err) });
        return [t.id, 'unknown'] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
