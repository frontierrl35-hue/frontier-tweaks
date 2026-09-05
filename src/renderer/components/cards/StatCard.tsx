import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
}

export function StatCard({ icon: Icon, label, value, sublabel }: Props) {
  return (
    <div className="ft-card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-[10px] bg-[var(--ft-accent-soft)] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[var(--ft-accent-light)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-[var(--ft-text-muted)]">{label}</div>
        <div className="text-sm font-semibold text-[var(--ft-text-primary)] truncate mt-0.5">{value}</div>
        {sublabel && <div className="text-[11px] text-[var(--ft-text-muted)] mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
