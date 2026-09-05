import { app } from 'electron';
import { spawn } from 'node:child_process';
import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';

/**
 * Frontier Tweaks touches services, HKLM registry keys, and system restore
 * points — nearly everything in the app requires administrator rights. We
 * detect real elevation state via Windows' own security API rather than
 * assuming, and never silently proceed as if elevated when we are not.
 */
export async function isElevated(): Promise<boolean> {
  const script =
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())." +
    "IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)";
  const res = await runPowerShell(script, 8000);
  if (!res.success) return false;
  return res.stdout.trim().toLowerCase() === 'true';
}

/**
 * Relaunches the packaged app with a UAC elevation prompt, then exits the
 * current (unelevated) instance. In dev (running under `electron .`/vite)
 * this relaunches Electron itself the same way.
 */
export function relaunchElevated() {
  const exePath = app.getPath('exe');
  try {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `Start-Process -FilePath '${exePath.replace(/'/g, "''")}' -Verb RunAs`,
      ],
      { detached: true, stdio: 'ignore', windowsHide: true }
    );
    child.unref();
  } catch (err) {
    logger.error('relaunch-elevated-failed', { error: String(err) });
  }
  app.exit(0);
}
