import { create } from 'zustand';
import type { ProgressUpdate, TweakMeta, TweakStatus } from '../../shared/types';

interface RunProgress {
  runId: string;
  total: number;
  completedSteps: Array<{ id: string; name: string; success: boolean }>;
  current: ProgressUpdate | null;
  active: boolean;
  summaryMessage: string | null;
}

interface TweakState {
  tweaks: TweakMeta[];
  statuses: Record<string, TweakStatus>;
  loading: boolean;
  run: RunProgress;
  pendingSingle: { id: string; name: string } | null;

  loadTweaks: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  applyTweak: (id: string) => Promise<void>;
  revertTweak: (id: string) => Promise<void>;
  applyAll: (ids: string[]) => Promise<void>;
  setPendingSingle: (v: { id: string; name: string } | null) => void;
  resetRun: () => void;
}

const emptyRun: RunProgress = { runId: '', total: 0, completedSteps: [], current: null, active: false, summaryMessage: null };

export const useTweakStore = create<TweakState>((set, get) => {
  // Subscribe once to progress events from the main process.
  window.frontier?.tweaks.onProgress((update: ProgressUpdate) => {
    set((state) => {
      const steps = [...state.run.completedSteps];
      if (update.phase === 'success' || update.phase === 'error') {
        steps.push({ id: update.tweakId, name: update.tweakName, success: update.phase === 'success' });
      }
      return {
        run: {
          ...state.run,
          runId: update.runId,
          total: update.total,
          current: update,
          completedSteps: steps,
          active: update.phase !== 'done',
        },
      };
    });
  });

  return {
    tweaks: [],
    statuses: {},
    loading: false,
    run: emptyRun,
    pendingSingle: null,

    loadTweaks: async () => {
      set({ loading: true });
      try {
        const res = await window.frontier.tweaks.list();
        if (res.success) set({ tweaks: (res.data as TweakMeta[]) ?? [] });
        await get().refreshStatuses();
      } finally {
        set({ loading: false });
      }
    },

    refreshStatuses: async () => {
      const res = await window.frontier.tweaks.getStatuses();
      if (res.success) set({ statuses: res.data as Record<string, TweakStatus> });
    },

    applyTweak: async (id) => {
      set({ pendingSingle: null });
      await window.frontier.tweaks.apply(id);
      await get().refreshStatuses();
    },

    revertTweak: async (id) => {
      await window.frontier.tweaks.revert(id);
      await get().refreshStatuses();
    },

    applyAll: async (ids) => {
      set({ run: { ...emptyRun, active: true, total: ids.length } });
      const res = await window.frontier.tweaks.applyAll(ids);
      const summary = res.data as { completed: number; failed: number } | undefined;
      set((state) => ({
        run: {
          ...state.run,
          active: false,
          summaryMessage: summary ? `${summary.completed} completed, ${summary.failed} failed.` : res.message,
        },
      }));
      await get().refreshStatuses();
    },

    setPendingSingle: (v) => set({ pendingSingle: v }),
    resetRun: () => set({ run: emptyRun }),
  };
});
