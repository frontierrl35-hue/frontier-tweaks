import { create } from 'zustand';

interface AppState {
  isBooting: boolean;
  isMaximized: boolean;
  errorDialog: { title: string; message: string; detail?: string } | null;
  setBooting: (v: boolean) => void;
  setMaximized: (v: boolean) => void;
  showError: (title: string, message: string, detail?: string) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isBooting: true,
  isMaximized: false,
  errorDialog: null,
  setBooting: (v) => set({ isBooting: v }),
  setMaximized: (v) => set({ isMaximized: v }),
  showError: (title, message, detail) => set({ errorDialog: { title, message, detail } }),
  clearError: () => set({ errorDialog: null }),
}));
