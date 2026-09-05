import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface PageTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Rendered next to the label when this tab isn't built yet, e.g. "Soon". */
  badge?: string;
}

interface Props {
  tabs: PageTab[];
  active: string;
  onChange: (id: string) => void;
  /** Right-aligned slot for a page-level action button (e.g. "Apply All"). */
  action?: ReactNode;
}

/**
 * Underline-style top tab bar used to split a category page into sub-sections
 * (e.g. Debloat: System Cleaner / Services / Uninstall / Autoruns).
 */
export function PageTabs({ tabs, active, onChange, action }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--ft-border)]">
      <div className="flex items-center gap-1 -mb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`no-drag relative flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[var(--ft-text-primary)]'
                  : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)]'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-[var(--ft-accent-light)]' : ''} />
              {tab.label}
              {tab.badge && (
                <span className="text-[10px] font-medium text-[var(--ft-text-muted)] bg-[var(--ft-surface-raised)] border border-[var(--ft-border)] px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
              {isActive && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--ft-accent)] rounded-full" />}
            </button>
          );
        })}
      </div>
      {action}
    </div>
  );
}

/** Simple honest placeholder for a tab whose backend feature isn't built yet. */
export function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="ft-card p-10 flex flex-col items-center text-center gap-1.5">
      <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--ft-text-secondary)] max-w-md">{description}</p>
    </div>
  );
}
