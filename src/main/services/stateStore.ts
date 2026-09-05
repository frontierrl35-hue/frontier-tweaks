import fs from 'node:fs/promises';
import { getStateFile } from '../utils/paths';
import { logger } from '../utils/logger';
import type { AuthStatus } from '../../shared/types';

export interface PersistedState {
  tweakStatus: Record<string, { status: string; appliedAt?: string }>;
  backups: Record<string, unknown>;
  /** True once the one-time "Before Frontier Tweaks" restore point has been
   *  created. Prevents creating a duplicate restore point on every launch. */
  initialRestorePointCreated?: boolean;
  /** Opaque session token from the auth server (server/index.js), stored
   *  as-is -- the main process never decodes or trusts it on its own; it's
   *  just replayed to /auth/status for verification and a live role check. */
  authToken?: string;
  /** Last known-good status, shown instantly on launch before the async
   *  /auth/status refresh completes. */
  lastAuthStatus?: AuthStatus;
}

const DEFAULT_STATE: PersistedState = { tweakStatus: {}, backups: {} };

let cache: PersistedState | null = null;

export async function readState(): Promise<PersistedState> {
  if (cache) return cache;
  let next: PersistedState;
  try {
    const raw = await fs.readFile(getStateFile(), 'utf-8');
    next = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    next = { ...DEFAULT_STATE };
  }
  cache = next;
  return next;
}

async function persist() {
  if (!cache) return;
  try {
    await fs.writeFile(getStateFile(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    logger.error('state-write-failed', { error: String(err) });
  }
}

export async function setTweakStatus(id: string, status: string) {
  const state = await readState();
  state.tweakStatus[id] = { status, appliedAt: new Date().toISOString() };
  await persist();
}

export async function writeBackupBlob(id: string, blob: unknown) {
  const state = await readState();
  state.backups[id] = blob;
  await persist();
}

export async function markInitialRestorePointCreated() {
  const state = await readState();
  state.initialRestorePointCreated = true;
  await persist();
}

export async function setAuthToken(token: string | null) {
  const state = await readState();
  if (token) state.authToken = token;
  else delete state.authToken;
  await persist();
}

export async function getAuthToken(): Promise<string | null> {
  const state = await readState();
  return state.authToken ?? null;
}

export async function setLastAuthStatus(status: AuthStatus | null) {
  const state = await readState();
  if (status) state.lastAuthStatus = status;
  else delete state.lastAuthStatus;
  await persist();
}

export async function getLastAuthStatus(): Promise<AuthStatus | null> {
  const state = await readState();
  return state.lastAuthStatus ?? null;
}
