import { create } from 'zustand';
import type { AppSettings } from '../../shared/types';

interface SettingsState extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
}

const defaults: AppSettings = {
  accentColor: '#7c5cff',
  animationsEnabled: true,
  launchOnStartup: false,
  notificationsEnabled: true,
  backupLocation: 'Default (App Data)',
};

// Renderer-side preference cache. These are cosmetic/UX settings; anything
// security-sensitive (like real registry state) always lives in and is
// verified by the main process, never trusted from here alone.
export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,
  update: (patch) => set((s) => ({ ...s, ...patch })),
}));
