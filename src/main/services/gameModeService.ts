import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import type { DetectedGame, GameModeStatus } from '../../shared/types';

async function getServiceStartModeSafe(serviceName: string): Promise<string | null> {
  const script = `try { (Get-CimInstance Win32_Service -Filter "Name='${serviceName}'" -ErrorAction Stop).StartMode } catch { '__MISSING__' }`;
  const res = await runPowerShell(script, 8000);
  const value = res.stdout.trim();
  return value === '__MISSING__' || value === '' ? null : value;
}

async function setServiceStartModeSafe(serviceName: string, mode: 'Automatic' | 'Manual' | 'Disabled'): Promise<void> {
  await runPowerShell(`Set-Service -Name '${serviceName}' -StartupType ${mode} -ErrorAction SilentlyContinue; Write-Output 'OK'`, 8000);
}

/**
 * Curated list of well-known game process names, the same way the debloat
 * app catalog is curated — we never guess at what "is" a game by scanning
 * install folders or heuristics; we only recognize processes we can name
 * with confidence.
 */
const KNOWN_GAMES: Array<{ processName: string; displayName: string }> = [
  { processName: 'FortniteClient-Win64-Shipping', displayName: 'Fortnite' },
  { processName: 'RocketLeague', displayName: 'Rocket League' },
  { processName: 'VALORANT-Win64-Shipping', displayName: 'Valorant' },
  { processName: 'javaw', displayName: 'Minecraft (Java)' },
  { processName: 'Minecraft', displayName: 'Minecraft' },
  { processName: 'RobloxPlayerBeta', displayName: 'Roblox' },
  { processName: 'GTA5', displayName: 'Grand Theft Auto V' },
  { processName: 'cs2', displayName: 'Counter-Strike 2' },
  { processName: 'League of Legends', displayName: 'League of Legends' },
  { processName: 'LeagueClientUx', displayName: 'League of Legends' },
  { processName: 'r5apex', displayName: 'Apex Legends' },
  { processName: 'Overwatch', displayName: 'Overwatch 2' },
  { processName: 'destiny2', displayName: 'Destiny 2' },
  { processName: 'eldenring', displayName: 'Elden Ring' },
  { processName: 'cod', displayName: 'Call of Duty' },
];

let currentState: GameModeStatus = { enabled: false, detectedGame: null, actionsApplied: [] };
let originalPriority: string | null = null;
let searchWasIndexing = false;

export async function detectRunningGame(): Promise<DetectedGame | null> {
  const names = KNOWN_GAMES.map((g) => `'${g.processName}'`).join(',');
  const script = `
    $names = @(${names})
    Get-Process | Where-Object { $names -contains $_.ProcessName } |
      Select-Object -First 1 ProcessName,Id | ConvertTo-Json -Compress
  `;
  const res = await runPowerShell(script, 8000);
  if (!res.success || !res.stdout) return null;
  try {
    const parsed = JSON.parse(res.stdout);
    if (!parsed || !parsed.ProcessName) return null;
    const known = KNOWN_GAMES.find((g) => g.processName === parsed.ProcessName);
    return { processName: parsed.ProcessName, displayName: known?.displayName ?? parsed.ProcessName, pid: parsed.Id };
  } catch (err) {
    logger.warn('game-detect-parse-failed', { error: String(err) });
    return null;
  }
}

export function getGameModeStatus(): GameModeStatus {
  return currentState;
}

/**
 * Applies small, reversible optimizations for the currently detected game
 * and nothing else: a process priority bump (Windows-native, no injection)
 * and a temporary pause of Windows Search indexing so it doesn't compete
 * for disk I/O. Both are undone by disableGameMode(). No memory writes, no
 * anti-cheat interaction, no DLL injection of any kind.
 */
export async function enableGameMode(): Promise<GameModeStatus> {
  const game = await detectRunningGame();
  const actions: string[] = [];

  if (game) {
    const prioRes = await runPowerShell(
      `(Get-Process -Id ${game.pid}).PriorityClass | Out-String`,
      6000
    );
    originalPriority = prioRes.success ? prioRes.stdout.trim() : null;

    const setRes = await runPowerShell(
      `(Get-Process -Id ${game.pid}).PriorityClass = 'AboveNormal'; Write-Output 'OK'`,
      6000
    );
    if (setRes.success) actions.push(`Raised ${game.displayName} to Above Normal priority`);
  }

  const searchMode = await getServiceStartModeSafe('WSearch');
  searchWasIndexing = searchMode === 'Automatic' || searchMode === 'Auto';
  if (searchWasIndexing) {
    const paused = await runPowerShell("Stop-Service -Name 'WSearch' -Force -ErrorAction SilentlyContinue; Write-Output 'OK'", 8000);
    if (paused.success) actions.push('Paused Windows Search indexing');
  }

  currentState = { enabled: true, detectedGame: game, actionsApplied: actions };
  return currentState;
}

export async function disableGameMode(): Promise<GameModeStatus> {
  const game = currentState.detectedGame;

  if (game && originalPriority) {
    await runPowerShell(
      `try { (Get-Process -Id ${game.pid}).PriorityClass = '${originalPriority}' } catch {}; Write-Output 'OK'`,
      6000
    );
  }

  if (searchWasIndexing) {
    await setServiceStartModeSafe('WSearch', 'Automatic');
    await runPowerShell("Start-Service -Name 'WSearch' -ErrorAction SilentlyContinue; Write-Output 'OK'", 8000);
  }

  originalPriority = null;
  searchWasIndexing = false;
  currentState = { enabled: false, detectedGame: null, actionsApplied: [] };
  return currentState;
}
