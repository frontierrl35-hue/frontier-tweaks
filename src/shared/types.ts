// Shared type contracts between main process, preload bridge, and renderer.
// The renderer NEVER sees raw shell commands — only these serializable shapes.

export type TweakCategory =
  | 'general'
  | 'hardware'
  | 'network'
  | 'debloat'
  | 'advanced';

export type TweakStatus = 'not-applied' | 'applied' | 'unknown' | 'error' | 'unsupported';

/** Sub-grouping shown as tabs within a category page (currently used by
 *  General: Core / Privacy / QOL / Apps / Powerplan). Optional — a category
 *  whose tweaks don't set this just renders as a flat grid, no tabs. */
export type TweakSubcategory = 'core' | 'privacy' | 'qol' | 'apps' | 'powerplan';

export interface TweakMeta {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: TweakCategory;
  subcategory?: TweakSubcategory;
  /** Recently added tweak — shows a "New" badge. Set deliberately per tweak,
   *  never derived, so it stays accurate as the registry grows. */
  isNew?: boolean;
  reversible: boolean;
  risk: 'low' | 'medium' | 'high';
  requiresAdmin: boolean;
  requiresRestart?: boolean;
  /** Set when a tweak from the spec has no single verified-correct implementation
   *  across Windows builds. Never fabricate a registry value to fill this gap —
   *  ship it disabled with an honest reason instead. */
  unsupportedReason?: string;
  /** Marks a tweak that weakens a security protection. TweakCard shows a
   *  persistent warning banner and requires its own confirmation dialog
   *  (separate from the general Apply All confirmation) before running. */
  dangerous?: boolean;
  /** Short warning shown in the dangerous-tweak banner and confirmation dialog. */
  dangerWarning?: string;
  /** Gates this tweak behind the "Premium Tweaker" Discord role. Omitted (or
   *  'free') means everyone can use it. Checked client-side against the
   *  signed-in user's live AuthStatus — never trust a locally-cached flag for
   *  anything beyond UI gating, since the real enforcement is that free users
   *  never see a signed session with premium: true in the first place. */
  tier?: 'free' | 'premium';
}

export interface TweakStateEntry {
  id: string;
  status: TweakStatus;
  appliedAt?: string;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  durationMs?: number;
}

export interface ProgressUpdate {
  runId: string;
  tweakId: string;
  tweakName: string;
  index: number;
  total: number;
  phase: 'running' | 'success' | 'error' | 'done';
  message?: string;
}

export interface ApplyAllSummary {
  runId: string;
  total: number;
  completed: number;
  failed: number;
  results: Array<{ id: string; success: boolean; message: string }>;
}

export interface SystemInfoSnapshot {
  cpu: { model: string; cores: number; speedGHz: number };
  gpu: { model: string }[];
  ram: { totalGB: number; freeGB: number };
  os: { distro: string; release: string; build: string; arch: string };
  uptimeSeconds: number;
  hostname: string;
}

/**
 * Live point-in-time resource usage, sampled fresh on every request —
 * never fabricated. GPU sampling relies on Windows' GPU Engine performance
 * counters; on machines/drivers where that counter set isn't published,
 * `gpuPercent` comes back `null` rather than a made-up number, and the
 * chart should show that metric as unavailable instead of a fake line.
 */
export interface UsageSnapshot {
  cpuPercent: number;
  ramPercent: number;
  gpuPercent: number | null;
}

export interface HardwareSnapshot extends SystemInfoSnapshot {
  motherboard: { manufacturer: string; model: string };
  storage: { device: string; sizeGB: number; type: string }[];
  bios: { vendor: string; version: string };
  network: { iface: string; mac: string; type: string }[];
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: string;
  tweakIds: string[];
}

export interface AppSettings {
  accentColor: string;
  animationsEnabled: boolean;
  launchOnStartup: boolean;
  notificationsEnabled: boolean;
  backupLocation: string;
}

export interface RemovableAppInfo {
  id: string;
  displayName: string;
  installed: boolean;
}

export interface UninstallAppsSummary {
  total: number;
  removed: number;
  failed: number;
  results: Array<{ id: string; displayName: string; success: boolean; message: string }>;
}

export interface QosPolicyInfo {
  name: string;
  appPath: string;
}

// ---- Admin elevation --------------------------------------------------
export interface ElevationStatus {
  elevated: boolean;
}

// ---- BIOS / firmware check ---------------------------------------------
export type BiosCheckState = 'enabled' | 'disabled' | 'not-detectable' | 'unknown';

export interface BiosCheckItem {
  id: string;
  name: string;
  description: string;
  state: BiosCheckState;
  detail: string;
  /** When the setting can't be read/changed from Windows at all, point the
   *  user at the real place to fix it instead of pretending we handled it. */
  manualInstructions?: string;
}

// ---- Frontier Game Mode --------------------------------------------------
export interface DetectedGame {
  processName: string;
  displayName: string;
  pid: number;
}

export interface GameModeStatus {
  enabled: boolean;
  detectedGame: DetectedGame | null;
  actionsApplied: string[];
}

// ---- Fixes (Backups & Fixes page) ---------------------------------------
export type FixStage = 'checking' | 'detected' | 'repairing' | 'completed' | 'failed';

export interface FixMeta {
  id: string;
  name: string;
  description: string;
  guidedOnly: boolean;
  guidedUrl?: string;
}

export interface FixStepUpdate {
  fixId: string;
  stage: FixStage;
  message: string;
}

export interface FixRunResult {
  fixId: string;
  success: boolean;
  message: string;
  steps: string[];
}

// ---- Restore points -------------------------------------------------------
export interface RestorePointInfo {
  sequenceNumber: number;
  description: string;
  creationTime: string;
}

export const DISCORD_URL = 'https://discord.gg/udpMWQs5a';
export const APP_VERSION = '1.0.0';

// ---- Discord auth / premium gating ----------------------------------------
export interface AuthStatus {
  signedIn: boolean;
  discordId?: string;
  username?: string;
  avatar?: string | null;
  /** True only when the backend's live check found the "Premium Tweaker"
   *  role on the user's account in your guild. */
  premium: boolean;
  /** Set when a status refresh couldn't reach the backend — the app is
   *  showing the last known-good value rather than a just-verified one. */
  offline?: boolean;
}

// ---- Auto-updater ----------------------------------------------------------
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatusPayload {
  phase: UpdatePhase;
  /** Version string of the update in question (for 'available'/'downloaded'). */
  version?: string;
  /** Download progress, 0-100 (for 'downloading'). */
  percent?: number;
  message?: string;
}
