import { useEffect, useState } from 'react';
import { FolderSearch, X } from 'lucide-react';
import { Button } from '../buttons/Button';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import type { QosPolicyInfo } from '../../../shared/types';

export function NetworkPriority() {
  const [policies, setPolicies] = useState<QosPolicyInfo[] | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    window.frontier.network.listQosPolicies().then((res) => {
      if (res.success) setPolicies(res.data as QosPolicyInfo[]);
    });
  };

  useEffect(load, []);

  const browse = async () => {
    const res = await window.frontier.network.pickExecutable();
    if (res.success && res.data) setPendingPath(res.data as string);
  };

  const confirmCreate = async () => {
    if (!pendingPath) return;
    setBusy(true);
    try {
      await window.frontier.network.createQosPolicy(pendingPath);
      setPendingPath(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (fileName: string) => {
    setBusy(true);
    try {
      await window.frontier.network.removeQosPolicy(fileName);
      load();
    } finally {
      setBusy(false);
    }
  };

  const fileName = pendingPath ? pendingPath.split(/[/\\]/).pop() : null;

  return (
    <div className="ft-card p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Network Priority</h2>
        <p className="text-xs text-[var(--ft-text-secondary)] mt-1">
          Tags a chosen application's traffic for priority handling by QoS-aware routers and network hardware. This
          prioritizes how traffic is scheduled on your PC and network — it cannot override internet, ISP, or game
          server latency.
        </p>
      </div>

      <Button variant="secondary" size="sm" className="self-start" onClick={browse}>
        <FolderSearch size={13} /> Search for EXE
      </Button>

      {policies === null ? (
        <div className="text-xs text-[var(--ft-text-muted)]">Loading policies…</div>
      ) : policies.length === 0 ? (
        <div className="text-xs text-[var(--ft-text-muted)]">No priority policies configured yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {policies.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)]">
              <div className="min-w-0">
                <div className="text-xs text-[var(--ft-text-secondary)] truncate">{p.name}</div>
                <div className="text-[10px] text-[var(--ft-text-muted)] truncate">{p.appPath}</div>
              </div>
              <button
                onClick={() => remove(p.name)}
                disabled={busy}
                className="no-drag shrink-0 text-[var(--ft-text-muted)] hover:text-[var(--ft-danger)] transition"
                aria-label="Remove policy"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingPath && fileName && (
        <ConfirmationDialog
          title="Apply network priority policy?"
          message={`Executable:\n${pendingPath}\n\nDetected: Yes\n\nThis prioritizes traffic handling for ${fileName} — it does not guarantee lower ping.`}
          confirmLabel="Apply"
          onConfirm={confirmCreate}
          onCancel={() => setPendingPath(null)}
        />
      )}
    </div>
  );
}
