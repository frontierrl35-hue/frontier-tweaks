import { useEffect, useState } from 'react';
import { History, Wrench, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Button } from '../components/buttons/Button';
import { BackupCard } from '../components/cards/BackupCard';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import type { BackupRecord, FixMeta, FixRunResult, RestorePointInfo } from '../../shared/types';

function FixCard({ fix }: { fix: FixMeta }) {
  const [stage, setStage] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<FixRunResult | null>(null);

  const run = async () => {
    if (fix.guidedOnly) {
      if (fix.guidedUrl?.startsWith('https://')) await window.frontier.system.openExternal(fix.guidedUrl);
      return;
    }
    setStage('running');
    const res = await window.frontier.fixes.run(fix.id);
    setResult(res.data as FixRunResult);
    setStage('done');
  };

  return (
    <div className="ft-card p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">{fix.name}</h3>
        <p className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed">{fix.description}</p>
      </div>
      <div className="flex items-center justify-between mt-1">
        {stage === 'done' && result ? (
          <span className={`flex items-center gap-1.5 text-xs ${result.success ? 'text-[var(--ft-success)]' : 'text-[var(--ft-danger)]'}`}>
            {result.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {result.message}
          </span>
        ) : (
          <span />
        )}
        <Button variant="secondary" size="sm" onClick={run} loading={stage === 'running'}>
          {fix.guidedOnly ? (
            <>
              <ExternalLink size={13} /> Open Guide
            </>
          ) : (
            <>
              <Wrench size={13} /> {stage === 'done' ? 'Run Again' : 'Diagnose & Fix'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function BackupsFixesPage() {
  const [restorePoints, setRestorePoints] = useState<RestorePointInfo[]>([]);
  const [creatingRestore, setCreatingRestore] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [pendingRestore, setPendingRestore] = useState<BackupRecord | null>(null);
  const [fixes, setFixes] = useState<FixMeta[]>([]);

  const refreshRestorePoints = () =>
    window.frontier.backups.listRestorePoints().then((res) => res.success && setRestorePoints(res.data as RestorePointInfo[]));
  const refreshBackups = () =>
    window.frontier.backups.list().then((res) => res.success && setBackups(res.data as BackupRecord[]));

  useEffect(() => {
    refreshRestorePoints();
    refreshBackups();
    window.frontier.fixes.list().then((res) => res.success && setFixes(res.data as FixMeta[]));
    // One-time, no-duplicate initial restore point — safe to call every
    // launch since the main process guards it with a persisted flag.
    window.frontier.backups.ensureInitialRestorePoint();
  }, []);

  const createRestorePoint = async () => {
    setCreatingRestore(true);
    setRestoreMsg(null);
    const res = await window.frontier.backups.createRestorePoint('Frontier Tweaks Checkpoint');
    setRestoreMsg(res.message);
    setCreatingRestore(false);
    refreshRestorePoints();
  };

  const createBackup = async () => {
    await window.frontier.backups.create(`Backup ${new Date().toLocaleString()}`);
    refreshBackups();
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Backups &amp; Fixes</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1 max-w-2xl">
          A one-time "Before Frontier Tweaks" restore point is created on first launch. Create tweak-state backups
          before a big batch of changes, and use the diagnostics below if something breaks.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[var(--ft-accent-light)]">
            <History size={16} />
            <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Windows Restore Points</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={createRestorePoint} loading={creatingRestore}>
            Create Checkpoint Now
          </Button>
        </div>
        {restoreMsg && <p className="text-xs text-[var(--ft-text-muted)] mb-3">{restoreMsg}</p>}
        {restorePoints.length === 0 ? (
          <div className="ft-card p-6 text-center text-sm text-[var(--ft-text-muted)]">
            No restore points detected yet, or System Restore is disabled on this drive.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {restorePoints.map((rp) => (
              <div key={rp.sequenceNumber} className="ft-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--ft-text-primary)]">{rp.description}</div>
                  <div className="text-[11px] text-[var(--ft-text-muted)] mt-0.5">{rp.creationTime || 'Unknown time'}</div>
                </div>
                <span className="text-[11px] text-[var(--ft-text-muted)]">#{rp.sequenceNumber}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Tweak-State Backups</h2>
          <Button variant="secondary" size="sm" onClick={createBackup}>
            Create Backup
          </Button>
        </div>
        {backups.length === 0 ? (
          <div className="ft-card p-6 text-center text-sm text-[var(--ft-text-muted)]">
            No backups yet. Create one before applying a batch of tweaks.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {backups.map((b) => (
              <BackupCard
                key={b.id}
                backup={b}
                onRestore={() => setPendingRestore(b)}
                onDelete={() => window.frontier.backups.delete(b.id).then(refreshBackups)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--ft-text-primary)] mb-3">Fixes</h2>
        {fixes.length === 0 ? (
          <div className="ft-card p-10 flex items-center justify-center text-sm text-[var(--ft-text-muted)] gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading fixes…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixes.map((fix) => (
              <FixCard key={fix.id} fix={fix} />
            ))}
          </div>
        )}
      </section>

      {pendingRestore && (
        <ConfirmationDialog
          title={`Restore "${pendingRestore.name}"?`}
          message="This will revert every reversible tweak captured in this backup to its original state."
          confirmLabel="Restore"
          onConfirm={() => {
            window.frontier.backups.restore(pendingRestore.id).finally(() => setPendingRestore(null));
          }}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  );
}
