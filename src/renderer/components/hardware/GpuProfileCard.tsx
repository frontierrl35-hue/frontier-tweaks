import type { LucideIcon } from 'lucide-react';
import { Check, ArrowRight } from 'lucide-react';

interface RatingRow {
  icon: LucideIcon;
  label: string;
  /** 0-5 filled dots */
  rating: number;
}

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  rows: RatingRow[];
  applied: boolean;
  onApply: () => void;
  busy?: boolean;
}

function DotMeter({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < rating ? 'bg-[var(--ft-accent-2)]' : 'bg-[var(--ft-border)]'}`}
        />
      ))}
    </div>
  );
}

export function GpuProfileCard({ icon: Icon, title, description, rows, applied, onApply, busy }: Props) {
  return (
    <div className="ft-card ft-glow-on-hover p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={16} className="text-[var(--ft-text-secondary)] shrink-0" />
          <h3 className="text-sm font-semibold text-[var(--ft-text-primary)] truncate">{title}</h3>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 shrink-0 ${
            applied ? 'text-[var(--ft-success)] bg-[var(--ft-success-soft)]' : 'text-[var(--ft-text-muted)] bg-[var(--ft-surface-raised)]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${applied ? 'bg-[var(--ft-success)]' : 'bg-[var(--ft-text-muted)]'}`} />
          {applied ? 'Active' : 'Inactive'}
        </span>
      </div>

      <p className="text-sm text-[var(--ft-accent-light)] leading-relaxed -mt-2">{description}</p>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[var(--ft-text-secondary)] min-w-0">
              <row.icon size={14} className="text-[var(--ft-text-muted)] shrink-0" />
              <span className="truncate">{row.label}</span>
            </div>
            <DotMeter rating={row.rating} />
          </div>
        ))}
      </div>

      <button
        onClick={onApply}
        disabled={applied || busy}
        className={`no-drag w-full flex items-center justify-center gap-2 rounded-[var(--ft-radius-pill)] py-3 text-sm font-medium transition-all disabled:cursor-not-allowed ${
          applied
            ? 'bg-[var(--ft-surface-raised)] text-[var(--ft-success)] border border-[var(--ft-border)]'
            : 'ft-btn-gradient'
        }`}
      >
        {applied ? (
          <>
            <Check size={15} /> Applied
          </>
        ) : (
          <>
            Apply <ArrowRight size={15} />
          </>
        )}
      </button>
    </div>
  );
}
