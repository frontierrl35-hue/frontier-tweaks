import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../buttons/Button';
import type { BackupRecord } from '../../../shared/types';

interface Props {
  backup: BackupRecord;
  onRestore: () => void;
  onDelete: () => void;
}

export function BackupCard({ backup, onRestore, onDelete }: Props) {
  return (
    <div className="ft-card p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-[var(--ft-text-primary)]">{backup.name}</div>
        <div className="text-[11px] text-[var(--ft-text-muted)] mt-0.5">
          {new Date(backup.createdAt).toLocaleString()} · {backup.tweakIds.length} change(s)
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onRestore}>
          <RotateCcw size={13} /> Restore
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
