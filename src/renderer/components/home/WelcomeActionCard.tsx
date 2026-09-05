import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

type Tone = 'accent' | 'success' | 'danger';

const TONE_CTA: Record<Tone, string> = {
  accent: 'ft-btn-gradient',
  success: 'bg-transparent text-[var(--ft-success)] hover:text-[var(--ft-success)]',
  danger: 'bg-transparent text-[var(--ft-danger)] hover:text-[var(--ft-danger)]',
};

interface Props {
  icon: LucideIcon;
  ctaLabel: string;
  onCta: () => void;
  tone: Tone;
  title: string;
  subtitle: string;
}

export function WelcomeActionCard({ icon: Icon, ctaLabel, onCta, tone, title, subtitle }: Props) {
  return (
    <div className="ft-card p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[var(--ft-surface-raised)] border border-[var(--ft-border)] flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[var(--ft-text-secondary)]" />
        </div>
        <button
          onClick={onCta}
          className={`no-drag flex items-center gap-1 rounded-[var(--ft-radius-pill)] px-3.5 py-1.5 text-xs font-medium transition-all ${TONE_CTA[tone]}`}
        >
          {ctaLabel} <ChevronRight size={13} />
        </button>
      </div>
      <div>
        <div className="text-xl font-semibold text-[var(--ft-text-primary)]">{title}</div>
        <div className="text-xs text-[var(--ft-text-muted)] mt-1">{subtitle}</div>
      </div>
    </div>
  );
}
