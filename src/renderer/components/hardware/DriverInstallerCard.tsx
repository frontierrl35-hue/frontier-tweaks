import { MonitorSmartphone, TriangleAlert, ArrowRight } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  onOpen: () => void;
  warning?: string;
}

export function DriverInstallerCard({ title, description, onOpen, warning }: Props) {
  return (
    <div className="ft-card ft-glow-on-hover p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--ft-accent-soft)] flex items-center justify-center shrink-0">
            <MonitorSmartphone size={18} className="text-[var(--ft-accent-light)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</h3>
        </div>
        {warning && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ft-danger)] bg-[var(--ft-danger-soft)] border border-[rgba(248,85,95,0.25)] rounded-full px-2.5 py-1 shrink-0">
            <TriangleAlert size={12} /> {warning}
          </span>
        )}
      </div>

      <p className="text-sm text-[var(--ft-text-secondary)] leading-relaxed -mt-1">{description}</p>

      <button
        onClick={onOpen}
        className="no-drag ft-btn-gradient w-full flex items-center justify-center gap-2 rounded-[var(--ft-radius-pill)] py-3 text-sm font-medium transition-all"
      >
        Open <ArrowRight size={15} />
      </button>
    </div>
  );
}
