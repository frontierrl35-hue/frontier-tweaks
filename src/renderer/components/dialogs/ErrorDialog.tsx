import { XCircle } from 'lucide-react';
import { Button } from '../buttons/Button';
import { useAppStore } from '../../stores/appStore';

export function ErrorDialog() {
  const { errorDialog, clearError } = useAppStore();
  if (!errorDialog) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center no-drag">
      <div className="ft-card w-[400px] p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[rgba(248,85,95,0.12)] flex items-center justify-center shrink-0">
            <XCircle size={16} className="text-[var(--ft-danger)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">{errorDialog.title}</h2>
            <p className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed">{errorDialog.message}</p>
            {errorDialog.detail && (
              <p className="text-[11px] text-[var(--ft-text-muted)] mt-2 bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[8px] p-2 break-words">
                Reason: {errorDialog.detail}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={clearError}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
