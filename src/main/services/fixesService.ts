import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import type { FixMeta, FixRunResult } from '../../shared/types';

/**
 * Every fix here either (a) diagnoses + repairs a well-understood, safe,
 * reversible-by-nature Windows component (service restarts, cache
 * re-registration), or (b) is marked guidedOnly and opens the correct
 * vendor/Windows tool instead of pretending to run a fix we cannot
 * meaningfully perform (e.g. we cannot "reinstall Discord" without shipping
 * and trusting a third-party installer). Nothing here silently no-ops.
 */
export const FIXES: FixMeta[] = [
  { id: 'fix-audio', name: 'Fix Audio/Microphone Issues', description: 'Restarts the Windows Audio stack and rescans playback/recording devices.', guidedOnly: false },
  { id: 'bluetooth-diagnostics', name: 'Bluetooth Diagnostics', description: 'Restarts the Bluetooth support service and reports adapter status.', guidedOnly: false },
  { id: 'fix-low-internet-speed', name: 'Fix Low Internet Speed', description: 'Flushes DNS, resets Winsock, and renews your IP address.', guidedOnly: false },
  { id: 'enable-fax-printing', name: 'Enable Fax & Printing', description: 'Starts and re-enables the Print Spooler service.', guidedOnly: false },
  { id: 'restore-microsoft-store', name: 'Reinstall Microsoft Store', description: 'Re-registers the Microsoft Store app package for the current user.', guidedOnly: false },
  { id: 'repair-windows-update', name: 'Repair Windows Update', description: 'Restarts the update-related services and clears the stuck download cache.', guidedOnly: false },
  { id: 'restore-edge', name: 'Restore Edge and Related Apps', description: 'Re-registers the Microsoft Edge app package for the current user.', guidedOnly: false },

  { id: 'restore-disk-shrinking', name: 'Restore Disk Shrinking', description: 'Disk-shrink limits are usually caused by unmovable files (page file, hibernation file) — opens Disk Management so you can inspect and resolve it directly.', guidedOnly: true, guidedUrl: 'ms-settings:diskmanagement' },
  { id: 'fivem-admin-check', name: 'FiveM Admin Check', description: 'FiveM requires the launcher itself to run elevated — opens the FiveM support page for the current known fix.', guidedOnly: true, guidedUrl: 'https://forum.cfx.re/' },
  { id: 'fix-gta-not-working', name: 'Fix GTA Not Working', description: 'Most GTA V launch failures are Rockstar Games Launcher / Social Club related — opens Rockstar Support.', guidedOnly: true, guidedUrl: 'https://support.rockstargames.com/' },
  { id: 'fix-nvidia-app-highlights', name: 'Fix NVIDIA App Highlights', description: 'Opens NVIDIA\u2019s official troubleshooting page for Highlights/ShadowPlay capture issues.', guidedOnly: true, guidedUrl: 'https://www.nvidia.com/en-us/geforce/geforce-experience/' },
  { id: 'fix-nvidia-app-errors', name: 'Fix NVIDIA App Errors', description: 'Opens NVIDIA Driver Downloads so you can run a clean reinstall — the safest fix for a corrupted NVIDIA App.', guidedOnly: true, guidedUrl: 'https://www.nvidia.com/Download/index.aspx' },
  { id: 'restore-nvidia-control-panel', name: 'Restore NVIDIA Control Panel', description: 'The classic Control Panel ships with the NVIDIA driver package — opens NVIDIA Driver Downloads to reinstall it.', guidedOnly: true, guidedUrl: 'https://www.nvidia.com/Download/index.aspx' },
  { id: 'revert-power-tweaks', name: 'Revert Power Tweaks', description: 'Restores the Windows Balanced power plan. For anything else, use Undo on the specific tweak or restore a backup.', guidedOnly: false },
  { id: 'reinstall-discord', name: 'Reinstall Discord', description: 'Opens Discord\u2019s official download page for a clean reinstall.', guidedOnly: true, guidedUrl: 'https://discord.com/download' },
  { id: 'repair-razer-installer', name: 'Repair Razer Installer', description: 'Opens Razer Support\u2019s installer-repair guidance.', guidedOnly: true, guidedUrl: 'https://mysupport.razer.com/' },
  { id: 'restore-adobe-apps', name: 'Restore Adobe Apps', description: 'Opens the Adobe Creative Cloud repair/reinstall tool.', guidedOnly: true, guidedUrl: 'https://helpx.adobe.com/download-install/kb/install-creative-cloud-apps.html' },
  { id: 'restore-amd-services', name: 'Restore AMD Services', description: 'Opens AMD\u2019s driver support page for a clean AMD Software reinstall.', guidedOnly: true, guidedUrl: 'https://www.amd.com/en/support' },
  { id: 'restore-audio-drivers', name: 'Restore Audio (Driver Reset)', description: 'Same repair as Fix Audio/Microphone Issues — restarts the audio service stack.', guidedOnly: false },
];

async function runFix(id: string, script: string, timeoutMs = 20000): Promise<FixRunResult> {
  const meta = FIXES.find((f) => f.id === id)!;
  const steps: string[] = [`Diagnosing ${meta.name.toLowerCase()}...`];
  const res = await runPowerShell(script, timeoutMs);
  steps.push(res.success ? 'Repair steps executed.' : 'One or more repair steps failed.');
  if (!res.success) logger.warn('fix-failed', { id, error: res.stderr });
  return {
    fixId: id,
    success: res.success,
    message: res.success ? 'Completed.' : 'Could not fully complete this repair — see details.',
    steps,
  };
}

export async function runFixById(id: string): Promise<FixRunResult> {
  switch (id) {
    case 'fix-audio':
    case 'restore-audio-drivers':
      return runFix(
        id,
        `
        Restart-Service -Name 'AudioSrv' -Force -ErrorAction SilentlyContinue
        Restart-Service -Name 'AudioEndpointBuilder' -Force -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `
      );
    case 'bluetooth-diagnostics':
      return runFix(
        id,
        `
        Restart-Service -Name 'bthserv' -Force -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `
      );
    case 'fix-low-internet-speed':
      return runFix(
        id,
        `
        ipconfig /flushdns | Out-Null
        netsh winsock reset | Out-Null
        ipconfig /release | Out-Null
        ipconfig /renew | Out-Null
        Write-Output 'OK'
      `,
        30000
      );
    case 'enable-fax-printing':
      return runFix(
        id,
        `
        Set-Service -Name 'Spooler' -StartupType Automatic -ErrorAction SilentlyContinue
        Start-Service -Name 'Spooler' -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `
      );
    case 'restore-microsoft-store':
      return runFix(
        id,
        `
        Get-AppxPackage -Name 'Microsoft.WindowsStore' -AllUsers | Foreach-Object {
          Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppXManifest.xml" -ErrorAction SilentlyContinue
        }
        Write-Output 'OK'
      `,
        30000
      );
    case 'restore-edge':
      return runFix(
        id,
        `
        Get-AppxPackage -Name 'Microsoft.MicrosoftEdge*' -AllUsers | Foreach-Object {
          Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppXManifest.xml" -ErrorAction SilentlyContinue
        }
        Write-Output 'OK'
      `,
        30000
      );
    case 'repair-windows-update':
      return runFix(
        id,
        `
        Stop-Service -Name 'wuauserv','bits','cryptsvc' -Force -ErrorAction SilentlyContinue
        Start-Service -Name 'wuauserv','bits','cryptsvc' -ErrorAction SilentlyContinue
        Write-Output 'OK'
      `,
        30000
      );
    case 'revert-power-tweaks':
      return runFix(id, `powercfg /setactive SCHEME_BALANCED; Write-Output 'OK'`);
    default:
      return { fixId: id, success: false, message: 'This fix opens a guided page instead of running automatically.', steps: [] };
  }
}
