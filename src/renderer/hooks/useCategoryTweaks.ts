import { useEffect, useMemo, useState } from 'react';
import { useTweakStore } from '../stores/tweakStore';
import type { TweakCategory } from '../../shared/types';

export function useCategoryTweaks(category: TweakCategory) {
  const { tweaks, statuses, loadTweaks, applyTweak, revertTweak } = useTweakStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (tweaks.length === 0) loadTweaks();
  }, [tweaks.length, loadTweaks]);

  const categoryTweaks = useMemo(() => tweaks.filter((t) => t.category === category), [tweaks, category]);

  const apply = async (id: string) => {
    setBusyId(id);
    try {
      await applyTweak(id);
    } finally {
      setBusyId(null);
    }
  };

  const revert = async (id: string) => {
    setBusyId(id);
    try {
      await revertTweak(id);
    } finally {
      setBusyId(null);
    }
  };

  return { tweaks: categoryTweaks, statuses, busyId, apply, revert };
}
