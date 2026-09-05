import { spawn } from 'node:child_process';
import { logger } from './logger';

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Runs a PowerShell script in a hidden, non-interactive process with a hard
 * timeout. Commands are passed as an argument array — never through a shell
 * string — so there is no shell-injection surface from tweak parameters.
 *
 * This is the ONLY place in the codebase allowed to spawn a process. The
 * renderer never has access to this function directly; it can only invoke
 * tweak IDs that are validated against the registry (see tweakRegistry.ts).
 */
export function runPowerShell(script: string, timeoutMs = 20_000): Promise<ExecResult> {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        script,
      ],
      { windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      logger.warn('exec-timeout', { script: script.slice(0, 120) });
      resolve({ success: false, stdout, stderr: 'Operation timed out.', code: null });
    }, timeoutMs);

    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      logger.error('exec-spawn-error', { error: String(err) });
      resolve({ success: false, stdout, stderr: String(err), code: null });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), code });
    });
  });
}

/** Validates an identifier (tweak id, backup id) against a strict safe pattern. */
export function isSafeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
}
