import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

function ensureDir(p: string): string {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
}

export function getAppDataRoot(): string {
  // Mirrors %ProgramData%\FrontierTweaks style location, but scoped to the
  // current user via Electron's userData path so no admin rights are needed
  // just to store state/logs/backups.
  return ensureDir(path.join(app.getPath('userData'), 'FrontierTweaks'));
}

export function getBackupsDir(): string {
  return ensureDir(path.join(getAppDataRoot(), 'backups'));
}

export function getLogsDir(): string {
  return ensureDir(path.join(getAppDataRoot(), 'logs'));
}

export function getStateFile(): string {
  return path.join(getAppDataRoot(), 'tweak-state.json');
}

export function getSettingsFile(): string {
  return path.join(getAppDataRoot(), 'settings.json');
}
