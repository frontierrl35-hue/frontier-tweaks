import { AlertTriangle } from 'lucide-react';
import { Button } from '../buttons/Button';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({ title, message, confirmLabel = 'Continue', danger, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center no-drag">
      <div className="ft-card w-[400px] p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
              danger ? 'bg-[rgba(248,85,95,0.12)]' : 'bg-[rgba(251,191,36,0.12)]'
            }`}
          >
            <AlertTriangle size={16} className={danger ? 'text-[var(--ft-danger)]' : 'text-[var(--ft-warning)]'} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</h2>
            <p className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
