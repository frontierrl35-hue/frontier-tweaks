import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '../buttons/Button';
import { useTweakStore } from '../../stores/tweakStore';

export function ProgressModal() {
  const { run, resetRun } = useTweakStore();

  if (!run.active && !run.summaryMessage) return null;

  const currentIndex = run.current?.index ?? 0;
  const total = run.total || 1;
  const percent = Math.min(100, Math.round((currentIndex / total) * 100));
  const finished = !run.active && run.summaryMessage;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center no-drag">
      <div className="ft-card w-[420px] p-6 flex flex-col gap-4 shadow-2xl">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">
            {finished ? 'Optimization complete' : 'Applying optimization'}
          </h2>
          {!finished && run.current && (
            <p className="text-xs text-[var(--ft-text-secondary)] mt-1">{run.current.tweakName}</p>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-[var(--ft-border)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ft-accent)] to-[var(--ft-accent-light)] transition-all duration-200"
            style={{ width: `${finished ? 100 : percent}%` }}
          />
        </div>

        <div className="text-xs text-[var(--ft-text-muted)] flex justify-between">
          <span>
            {finished ? run.summaryMessage : `Executing system configuration... Step ${currentIndex} of ${total}`}
          </span>
          {!finished && <span>{percent}%</span>}
        </div>

        <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 mt-1">
          {run.completedSteps.map((step, i) => (
            <div key={`${step.id}-${i}`} className="flex items-center gap-2 text-xs text-[var(--ft-text-secondary)]">
              {step.success ? (
                <CheckCircle2 size={13} className="text-[var(--ft-success)] shrink-0" />
              ) : (
                <XCircle size={13} className="text-[var(--ft-danger)] shrink-0" />
              )}
              <span className="truncate">{step.name}</span>
            </div>
          ))}
          {!finished && run.current && run.current.phase === 'running' && (
            <div className="flex items-center gap-2 text-xs text-[var(--ft-text-secondary)]">
              <Loader2 size={13} className="animate-spin text-[var(--ft-accent-light)] shrink-0" />
              <span className="truncate">{run.current.tweakName}</span>
            </div>
          )}
        </div>

        {finished && (
          <Button variant="primary" onClick={resetRun} className="self-end mt-1">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
