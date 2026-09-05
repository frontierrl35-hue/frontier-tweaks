import { useCallback, useEffect, useState } from 'react';
import type { UpdateStatusPayload } from '../../shared/types';

/** Renderer-side view of the main process's auto-updater. Reads the current
 *  status once on mount (in case a check already happened before this
 *  component existed), then stays live via the 'updater:status' IPC event. */
export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatusPayload>({ phase: 'idle' });

  useEffect(() => {
    let cancelled = false;
    window.frontier.updater.getStatus().then((res) => {
      if (!cancelled && res.success && res.data) setStatus(res.data);
    });
    const unsubscribe = window.frontier.updater.onStatus((s) => setStatus(s));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const check = useCallback(() => window.frontier.updater.check(), []);
  const download = useCallback(() => window.frontier.updater.download(), []);
  const install = useCallback(() => window.frontier.updater.install(), []);

  return { status, check, download, install };
}
