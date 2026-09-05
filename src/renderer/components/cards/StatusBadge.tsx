import clsx from 'clsx';
import type { TweakStatus } from '../../../shared/types';

const CONFIG: Record<TweakStatus, { label: string; className: string }> = {
  applied: { label: 'Applied', className: 'text-[var(--ft-success)] bg-[var(--ft-success-soft)]' },
  'not-applied': { label: 'Not Applied', className: 'text-[var(--ft-text-secondary)] bg-[var(--ft-surface-raised)]' },
  unknown: { label: 'Unknown', className: 'text-[var(--ft-warning)] bg-[var(--ft-warning-soft)]' },
  error: { label: 'Error', className: 'text-[var(--ft-danger)] bg-[var(--ft-danger-soft)]' },
  unsupported: { label: 'Not Supported Yet', className: 'text-[var(--ft-text-muted)] bg-[var(--ft-surface-sunken)]' },
};

export function StatusBadge({ status }: { status: TweakStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.unknown;
  return (
    <span className={clsx('text-[11px] font-medium px-2 py-1 rounded-full', cfg.className)}>{cfg.label}</span>
  );
}
