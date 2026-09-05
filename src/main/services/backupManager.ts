import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getBackupsDir } from '../utils/paths';
import { readState, markInitialRestorePointCreated } from './stateStore';
import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import { getTweakById } from './tweakRegistry';
import type { BackupRecord, OperationResult, RestorePointInfo } from '../../shared/types';

interface BackupFile extends BackupRecord {
  snapshot: Record<string, unknown>;
}

export async function createBackup(name: string): Promise<OperationResult<BackupRecord>> {
  try {
    const state = await readState();
    const id = randomUUID();
    const record: BackupFile = {
      id,
      name: name?.trim() || `Backup ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      tweakIds: Object.keys(state.tweakStatus),
      snapshot: state.backups,
    };
    await fs.writeFile(path.join(getBackupsDir(), `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
    return { success: true, message: 'Backup created.', data: { id: record.id, name: record.name, createdAt: record.createdAt, tweakIds: record.tweakIds } };
  } catch (err) {
    logger.error('backup-create-failed', { error: String(err) });
    return { success: false, message: 'Could not create backup.', error: String(err) };
  }
}

export async function listBackups(): Promise<BackupRecord[]> {
  try {
    const dir = getBackupsDir();
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const records = await Promise.all(
      files.map(async (f) => {
        const raw = await fs.readFile(path.join(dir, f), 'utf-8');
        const parsed = JSON.parse(raw) as BackupFile;
        return { id: parsed.id, name: parsed.name, createdAt: parsed.createdAt, tweakIds: parsed.tweakIds };
      })
    );
    return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch (err) {
    logger.error('backup-list-failed', { error: String(err) });
    return [];
  }
}

export async function deleteBackup(id: string): Promise<OperationResult> {
  try {
    await fs.unlink(path.join(getBackupsDir(), `${id}.json`));
    return { success: true, message: 'Backup deleted.' };
  } catch (err) {
    return { success: false, message: 'Could not delete backup.', error: String(err) };
  }
}

/**
 * Restoring re-runs revert() for every tweak captured in the backup's
 * snapshot via the tweak registry, so the actual system state (registry
 * keys, etc.) is put back — not just the bookkeeping file.
 */
export async function restoreBackup(id: string): Promise<OperationResult> {
  try {
    const raw = await fs.readFile(path.join(getBackupsDir(), `${id}.json`), 'utf-8');
    const record = JSON.parse(raw) as BackupFile;
    const results: string[] = [];
    for (const tweakId of record.tweakIds) {
      const tweak = getTweakById(tweakId);
      if (!tweak || !tweak.reversible) continue;
      const res = await tweak.revert();
      results.push(`${tweakId}: ${res.success ? 'reverted' : 'failed'}`);
    }
    return { success: true, message: `Backup restored. ${results.length} tweak(s) processed.`, data: results };
  } catch (err) {
    logger.error('backup-restore-failed', { error: String(err) });
    return { success: false, message: 'Could not restore backup.', error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Windows System Restore points. Separate from the tweak-state backups above
// — this is a real OS-level checkpoint via the Volume Shadow Copy service,
// used once at first launch as a safety net for everything Frontier Tweaks
// touches outside the registry (services, features, drivers).
// ---------------------------------------------------------------------------

export async function listRestorePoints(): Promise<RestorePointInfo[]> {
  const script =
    'Get-ComputerRestorePoint | Select-Object SequenceNumber,Description,CreationTime | ConvertTo-Json -Compress';
  const res = await runPowerShell(script, 15000);
  if (!res.success || !res.stdout) return [];
  try {
    const parsed = JSON.parse(res.stdout);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((r: any) => ({
      sequenceNumber: r.SequenceNumber,
      description: r.Description,
      // WMI DateTime string like /Date(169...)/ when serialized this way in
      // some PS versions — CIM's CreationTime already comes back ISO-ish in
      // Windows PowerShell 5.1's ConvertTo-Json, so just pass it through.
      creationTime: String(r.CreationTime ?? ''),
    }));
  } catch (err) {
    logger.warn('restore-point-list-parse-failed', { error: String(err) });
    return [];
  }
}

export async function createRestorePoint(description: string): Promise<OperationResult> {
  const script = `
    try {
      Enable-ComputerRestore -Drive "$env:SystemDrive\\" -ErrorAction SilentlyContinue
      Checkpoint-Computer -Description '${description.replace(/'/g, "''")}' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
      Write-Output 'OK'
    } catch {
      Write-Output "ERR:$($_.Exception.Message)"
    }
  `;
  const res = await runPowerShell(script, 60000);
  if (res.success && res.stdout.trim() === 'OK') {
    return { success: true, message: 'Restore point created.' };
  }
  // Windows limits System Restore to one checkpoint per 24h by default —
  // that's a normal, expected failure mode, not a bug in Frontier Tweaks.
  const throttled = /24 hours|frequency/i.test(res.stdout) || /24 hours|frequency/i.test(res.stderr);
  return {
    success: false,
    message: throttled
      ? 'Windows already created a restore point in the last 24 hours, so a new one was not needed.'
      : 'Could not create a restore point. System Restore may be disabled on this drive.',
    error: res.stdout || res.stderr,
  };
}

/**
 * Called once, on the very first launch, to create the "Before Frontier
 * Tweaks" checkpoint the spec requires. Guarded by a persisted flag so it
 * never fires again on subsequent launches, even if the checkpoint itself
 * was throttled or failed.
 */
export async function ensureInitialRestorePoint(): Promise<OperationResult> {
  const state = await readState();
  if (state.initialRestorePointCreated) {
    return { success: true, message: 'Initial restore point already handled.' };
  }
  const result = await createRestorePoint('Before Frontier Tweaks');
  await markInitialRestorePointCreated();
  return result;
}
