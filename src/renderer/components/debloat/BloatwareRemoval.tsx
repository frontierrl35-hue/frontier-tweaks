import { useEffect, useState } from 'react';
import { Trash2, CheckSquare, Square } from 'lucide-react';
import { Button } from '../buttons/Button';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import type { RemovableAppInfo, UninstallAppsSummary } from '../../../shared/types';

export function BloatwareRemoval() {
  const [apps, setApps] = useState<RemovableAppInfo[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<UninstallAppsSummary | null>(null);

  const load = () => {
    setApps(null);
    window.frontier.debloat.listApps().then((res) => {
      if (res.success) setApps(res.data as RemovableAppInfo[]);
    });
  };

  useEffect(load, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const installedApps = apps?.filter((a) => a.installed) ?? [];

  const selectAll = () => setSelected(new Set(installedApps.map((a) => a.id)));
  const deselectAll = () => setSelected(new Set());

  const runUninstall = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setSummary(null);
    try {
      const res = await window.frontier.debloat.uninstallApps(Array.from(selected));
      if (res.success) setSummary(res.data as UninstallAppsSummary);
      setSelected(new Set());
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ft-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Remove Built-in Apps</h2>
          <p className="text-xs text-[var(--ft-text-secondary)] mt-1">
            Uninstalls Microsoft Store bloatware for all users on this PC. Only apps actually detected as installed
            are removable — nothing is guessed.
          </p>
        </div>
        {installedApps.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        )}
      </div>

      {apps === null ? (
        <div className="text-xs text-[var(--ft-text-muted)]">Scanning installed apps…</div>
      ) : installedApps.length === 0 ? (
        <div className="text-xs text-[var(--ft-text-muted)]">None of the known removable apps are installed on this system.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {installedApps.map((app) => {
            const isSelected = selected.has(app.id);
            return (
              <button
                key={app.id}
                onClick={() => toggle(app.id)}
                className="no-drag flex items-center gap-2 text-left px-3 py-2 rounded-[8px] bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] hover:border-[var(--ft-border-hover)] transition text-xs text-[var(--ft-text-secondary)]"
              >
                {isSelected ? (
                  <CheckSquare size={14} className="text-[var(--ft-accent-light)] shrink-0" />
                ) : (
                  <Square size={14} className="text-[var(--ft-text-muted)] shrink-0" />
                )}
                <span className="truncate">{app.displayName}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <Button variant="danger" size="sm" className="self-start" onClick={() => setConfirmOpen(true)} loading={busy}>
          <Trash2 size={13} /> Uninstall Selected ({selected.size})
        </Button>
      )}

      {summary && (
        <div className="text-[11px] text-[var(--ft-text-muted)] border-t border-[var(--ft-border)] pt-3">
          {summary.removed} removed, {summary.failed} failed.
        </div>
      )}

      {confirmOpen && (
        <ConfirmationDialog
          title={`Uninstall ${selected.size} app(s)?`}
          message="These apps will be removed for all users on this PC. They can be reinstalled later from the Microsoft Store if needed."
          confirmLabel="Uninstall"
          danger
          onConfirm={runUninstall}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
