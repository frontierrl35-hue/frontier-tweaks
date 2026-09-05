import { ipcMain, shell, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { isSafeId } from '../utils/exec';
import { logger } from '../utils/logger';
import { getLogsDir } from '../utils/paths';
import { getSystemInfo, getHardwareInfo, getUsageSnapshot } from '../services/systemInfo';
import { detectAllStatuses, getTweakById, tweaksAsMeta } from '../services/tweakRegistry';
import { readState, setTweakStatus } from '../services/stateStore';
import { createBackup, deleteBackup, listBackups, restoreBackup, listRestorePoints, createRestorePoint, ensureInitialRestorePoint } from '../services/backupManager';
import { listRemovableApps, uninstallApps } from '../services/appxManager';
import { pickExecutable, listQosPolicies, createQosPolicy, removeQosPolicy } from '../services/qosManager';
import { isElevated, relaunchElevated } from '../services/adminService';
import { biosCheckSafe } from '../services/biosService';
import { detectRunningGame, enableGameMode, disableGameMode, getGameModeStatus } from '../services/gameModeService';
import { FIXES, runFixById } from '../services/fixesService';
import { checkForUpdates, downloadUpdate, installUpdate, getLastUpdateStatus } from '../services/updaterService';
import { startLogin, logout, getCachedStatus, refreshStatus } from '../services/authService';
import type { ApplyAllSummary, AuthStatus, OperationResult, ProgressUpdate } from '../../shared/types';

/** Wraps every handler so a thrown error becomes a structured failure result
 *  instead of an unhandled rejection that could destabilize the app. */
function safeHandle<Args extends unknown[], R>(
  channel: string,
  handler: (...args: Args) => Promise<R>
) {
  ipcMain.handle(channel, async (_event, ...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      logger.error('ipc-handler-error', { channel, error: String(err) });
      return { success: false, message: 'An unexpected error occurred.', error: String(err) } as OperationResult;
    }
  });
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  // ---- system ----------------------------------------------------------
  safeHandle('system:getInfo', async () => ({ success: true, message: 'ok', data: await getSystemInfo() }));
  safeHandle('system:getUsage', async () => ({ success: true, message: 'ok', data: await getUsageSnapshot() }));
  safeHandle('system:openExternal', async (url: string) => {
    if (!/^https:\/\//.test(url)) return { success: false, message: 'Blocked non-https URL.' };
    await shell.openExternal(url);
    return { success: true, message: 'Opened.' };
  });
  safeHandle('system:openLogsFolder', async () => {
    const err = await shell.openPath(getLogsDir());
    return err ? { success: false, message: 'Could not open logs folder.', error: err } : { success: true, message: 'Opened.' };
  });

  // ---- hardware ----------------------------------------------------------
  safeHandle('hardware:getInfo', async () => ({ success: true, message: 'ok', data: await getHardwareInfo() }));

  // ---- tweaks --------------------------------------------------------------
  safeHandle('tweaks:list', async () => ({ success: true, message: 'ok', data: tweaksAsMeta() }));

  safeHandle('tweaks:getStatuses', async () => {
    const [live, persisted] = await Promise.all([detectAllStatuses(), readState()]);
    // Prefer live-detected status; fall back to persisted record if detection
    // is inconclusive (e.g. tweak has no reliable single registry marker).
    const merged: Record<string, string> = { ...live };
    for (const [id, entry] of Object.entries(persisted.tweakStatus)) {
      if (merged[id] === 'unknown') merged[id] = entry.status;
    }
    return { success: true, message: 'ok', data: merged };
  });

  safeHandle('tweaks:apply', async (id: string) => {
    if (!isSafeId(id)) return { success: false, message: 'Invalid tweak id.' };
    const tweak = getTweakById(id);
    if (!tweak) return { success: false, message: 'Unknown tweak.' };
    const start = Date.now();
    const result = await tweak.apply();
    if (result.success) await setTweakStatus(id, 'applied');
    return { ...result, durationMs: Date.now() - start };
  });

  safeHandle('tweaks:revert', async (id: string) => {
    if (!isSafeId(id)) return { success: false, message: 'Invalid tweak id.' };
    const tweak = getTweakById(id);
    if (!tweak) return { success: false, message: 'Unknown tweak.' };
    if (!tweak.reversible) return { success: false, message: 'This tweak is not reversible.' };
    const start = Date.now();
    const result = await tweak.revert();
    if (result.success) await setTweakStatus(id, 'not-applied');
    return { ...result, durationMs: Date.now() - start };
  });

  safeHandle('tweaks:applyAll', async (ids: string[]) => {
    const runId = randomUUID();
    const win = getWindow();
    const validIds = ids.filter(isSafeId);
    const summary: ApplyAllSummary = { runId, total: validIds.length, completed: 0, failed: 0, results: [] };

    for (let i = 0; i < validIds.length; i++) {
      const id = validIds[i];
      const tweak = getTweakById(id);
      const progress: ProgressUpdate = {
        runId,
        tweakId: id,
        tweakName: tweak?.name ?? id,
        index: i + 1,
        total: validIds.length,
        phase: 'running',
      };
      win?.webContents.send('tweaks:progress', progress);

      if (!tweak) {
        summary.failed++;
        summary.results.push({ id, success: false, message: 'Unknown tweak.' });
        win?.webContents.send('tweaks:progress', { ...progress, phase: 'error', message: 'Unknown tweak.' });
        continue;
      }

      try {
        const res = await tweak.apply();
        if (res.success) {
          await setTweakStatus(id, 'applied');
          summary.completed++;
        } else {
          summary.failed++;
        }
        summary.results.push({ id, success: res.success, message: res.message });
        win?.webContents.send('tweaks:progress', {
          ...progress,
          phase: res.success ? 'success' : 'error',
          message: res.message,
        });
      } catch (err) {
        summary.failed++;
        summary.results.push({ id, success: false, message: 'Unexpected error.' });
        logger.error('apply-all-tweak-crashed', { id, error: String(err) });
        win?.webContents.send('tweaks:progress', { ...progress, phase: 'error', message: 'Unexpected error.' });
      }
    }

    win?.webContents.send('tweaks:progress', {
      runId,
      tweakId: '',
      tweakName: '',
      index: validIds.length,
      total: validIds.length,
      phase: 'done',
    });

    return { success: true, message: 'Apply All finished.', data: summary };
  });

  // ---- backups -----------------------------------------------------------
  safeHandle('backups:list', async () => ({ success: true, message: 'ok', data: await listBackups() }));
  safeHandle('backups:create', async (name: string) => createBackup(name));
  safeHandle('backups:restore', async (id: string) => (isSafeId(id) || /^[a-f0-9-]{36}$/.test(id) ? restoreBackup(id) : { success: false, message: 'Invalid backup id.' }));
  safeHandle('backups:delete', async (id: string) => (isSafeId(id) || /^[a-f0-9-]{36}$/.test(id) ? deleteBackup(id) : { success: false, message: 'Invalid backup id.' }));

  // ---- debloat / bloatware removal ---------------------------------------
  safeHandle('debloat:listApps', async () => ({ success: true, message: 'ok', data: await listRemovableApps() }));
  safeHandle('debloat:uninstallApps', async (ids: string[]) => {
    const validIds = ids.filter(isSafeId);
    const data = await uninstallApps(validIds);
    return { success: true, message: `${data.removed} removed, ${data.failed} failed.`, data };
  });

  // ---- network priority (QoS) --------------------------------------------
  safeHandle('network:pickExecutable', async () => {
    const path = await pickExecutable(getWindow());
    return { success: true, message: 'ok', data: path };
  });
  safeHandle('network:listQosPolicies', async () => ({ success: true, message: 'ok', data: await listQosPolicies() }));
  safeHandle('network:createQosPolicy', async (appPath: string) => {
    if (typeof appPath !== 'string' || !appPath.toLowerCase().endsWith('.exe')) {
      return { success: false, message: 'Please select a valid .exe file.' };
    }
    return createQosPolicy(appPath);
  });
  safeHandle('network:removeQosPolicy', async (fileName: string) => {
    if (typeof fileName !== 'string' || fileName.length > 128) return { success: false, message: 'Invalid policy.' };
    return removeQosPolicy(fileName);
  });

  // ---- admin elevation -----------------------------------------------------
  safeHandle('system:isElevated', async () => ({ success: true, message: 'ok', data: await isElevated() }));
  safeHandle('system:relaunchElevated', async () => {
    relaunchElevated();
    return { success: true, message: 'Relaunching…' };
  });

  // ---- BIOS safe check -------------------------------------------------------
  safeHandle('bios:check', async () => ({ success: true, message: 'ok', data: await biosCheckSafe() }));

  // ---- Frontier Game Mode -----------------------------------------------------
  safeHandle('gameMode:detect', async () => ({ success: true, message: 'ok', data: await detectRunningGame() }));
  safeHandle('gameMode:status', async () => ({ success: true, message: 'ok', data: getGameModeStatus() }));
  safeHandle('gameMode:enable', async () => ({ success: true, message: 'Frontier Game Mode enabled.', data: await enableGameMode() }));
  safeHandle('gameMode:disable', async () => ({ success: true, message: 'Frontier Game Mode disabled.', data: await disableGameMode() }));

  // ---- Fixes -----------------------------------------------------------------
  safeHandle('fixes:list', async () => ({ success: true, message: 'ok', data: FIXES }));
  safeHandle('fixes:run', async (id: string) => {
    if (!isSafeId(id)) return { success: false, message: 'Invalid fix id.' };
    const data = await runFixById(id);
    return { success: data.success, message: data.message, data };
  });

  // ---- Restore points ----------------------------------------------------------
  safeHandle('backups:listRestorePoints', async () => ({ success: true, message: 'ok', data: await listRestorePoints() }));
  safeHandle('backups:createRestorePoint', async (description: string) =>
    createRestorePoint(typeof description === 'string' && description.trim() ? description : 'Frontier Tweaks Checkpoint')
  );
  safeHandle('backups:ensureInitialRestorePoint', async () => ensureInitialRestorePoint());

  // ---- Auto-updater ----------------------------------------------------------
  safeHandle('updater:check', async () => checkForUpdates());
  safeHandle('updater:download', async () => downloadUpdate());
  safeHandle('updater:install', async () => installUpdate());
  safeHandle('updater:getStatus', async () => ({ success: true, message: 'ok', data: getLastUpdateStatus() }));

  // ---- Discord auth / premium status ------------------------------------------
  safeHandle('auth:login', async () => {
    startLogin();
    return { success: true, message: 'Opening Discord sign-in in your browser…' };
  });
  safeHandle('auth:logout', async () => {
    await logout();
    return { success: true, message: 'Signed out.' };
  });
  safeHandle('auth:getStatus', async () => ({ success: true, message: 'ok', data: await getCachedStatus() } as OperationResult<AuthStatus>));
  safeHandle('auth:refresh', async () => ({ success: true, message: 'ok', data: await refreshStatus() } as OperationResult<AuthStatus>));
}
