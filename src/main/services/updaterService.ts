import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { logger } from '../utils/logger';
import type { OperationResult, UpdateStatusPayload } from '../../shared/types';

/**
 * Thin wrapper around electron-updater. Design choices, on purpose:
 *  - autoDownload is OFF: this app already asks for admin/UAC and touches
 *    the registry — silently replacing itself mid-session would be a bad
 *    surprise. We check on startup, then wait for an explicit click to
 *    download and another to restart+install.
 *  - Every state change is pushed to the renderer over 'updater:status' so
 *    the UI (banner + Settings page) can render itself with no polling.
 *  - Never surfaces a failure as a blocking error: no network / no feed
 *    configured yet / rate-limited GitHub API should all just mean "no
 *    update available right now", not a crash or a scary dialog.
 */

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let getWindow: (() => BrowserWindow | null) | null = null;
let wired = false;
let lastStatus: UpdateStatusPayload = { phase: 'idle' };

function emit(status: UpdateStatusPayload) {
  lastStatus = status;
  getWindow?.()?.webContents.send('updater:status', status);
}

export function getLastUpdateStatus(): UpdateStatusPayload {
  return lastStatus;
}

/** Wires up autoUpdater event listeners and, in packaged builds only, kicks
 *  off a background check shortly after launch. Call once from main.ts. */
export function initUpdater(windowGetter: () => BrowserWindow | null) {
  if (wired) return;
  wired = true;
  getWindow = windowGetter;

  autoUpdater.on('checking-for-update', () => emit({ phase: 'checking' }));

  autoUpdater.on('update-available', (info) => {
    emit({ phase: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    emit({ phase: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    emit({ phase: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    emit({ phase: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('updater-error', { error: String(err) });
    emit({ phase: 'error', message: 'Could not check for updates.' });
  });

  if (app.isPackaged) {
    // Let the window paint first — no need to race a network call against
    // first render.
    setTimeout(() => {
      checkForUpdates().catch((err) => logger.error('updater-startup-check-failed', { error: String(err) }));
    }, 5000);
  }
}

export async function checkForUpdates(): Promise<OperationResult> {
  if (!app.isPackaged) {
    // No update feed exists for an unpackaged dev build — report this as a
    // normal, non-alarming state rather than letting electron-updater throw.
    emit({ phase: 'not-available', message: 'Updates are only available in installed builds.' });
    return { success: true, message: 'Skipped — not a packaged build.' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true, message: 'Checked for updates.' };
  } catch (err) {
    logger.error('updater-check-failed', { error: String(err) });
    emit({ phase: 'error', message: 'Could not check for updates.' });
    return { success: false, message: 'Could not check for updates.', error: String(err) };
  }
}

export async function downloadUpdate(): Promise<OperationResult> {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true, message: 'Downloading update…' };
  } catch (err) {
    logger.error('updater-download-failed', { error: String(err) });
    emit({ phase: 'error', message: 'Update download failed.' });
    return { success: false, message: 'Update download failed.', error: String(err) };
  }
}

export function installUpdate(): OperationResult {
  // Relaunches into the new version's installer/NSIS updater and quits.
  autoUpdater.quitAndInstall();
  return { success: true, message: 'Installing…' };
}
