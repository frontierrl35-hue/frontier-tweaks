import { CheckCircle2, Circle, ListChecks } from 'lucide-react';

export interface QuickstartItem {
  label: string;
  description: string;
  done: boolean;
  to: string;
}

interface Props {
  items: QuickstartItem[];
  onNavigate: (to: string) => void;
}

export function QuickstartChecklist({ items, onNavigate }: Props) {
  return (
    <div className="ft-card p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 text-[var(--ft-text-primary)]">
        <ListChecks size={16} />
        <span className="text-sm font-semibold">Quickstart</span>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto pr-1 -mr-1">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.to)}
            className="no-drag flex items-start gap-3 text-left group"
          >
            {item.done ? (
              <CheckCircle2 size={18} className="text-[var(--ft-success)] shrink-0 mt-0.5" />
            ) : (
              <Circle size={18} className="text-[var(--ft-text-muted)] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold ${
                  item.done ? 'text-[var(--ft-text-muted)] line-through' : 'text-[var(--ft-text-primary)]'
                }`}
              >
                {item.label}
              </div>
              <div className="text-xs text-[var(--ft-text-muted)] mt-0.5 leading-relaxed">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
