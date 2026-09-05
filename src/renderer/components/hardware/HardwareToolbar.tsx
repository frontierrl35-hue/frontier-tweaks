import { Search, SlidersHorizontal, ArrowUpDown, MonitorSmartphone, ChevronDown } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  gpuName?: string;
  driverVersion?: string;
  placeholder?: string;
}

export function HardwareToolbar({ search, onSearchChange, gpuName, driverVersion, placeholder }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder ?? 'Search'}
          className="no-drag w-full bg-[var(--ft-surface)] border border-[var(--ft-border)] rounded-[var(--ft-radius-pill)] pl-10 pr-4 py-2.5 text-sm text-[var(--ft-text-primary)] placeholder:text-[var(--ft-text-muted)] outline-none focus:border-[var(--ft-border-hover)] transition-colors"
        />
      </div>

      <button className="no-drag flex items-center gap-2 bg-[var(--ft-surface)] border border-[var(--ft-border)] rounded-[var(--ft-radius-pill)] px-4 py-2.5 text-sm text-[var(--ft-text-secondary)] hover:border-[var(--ft-border-hover)] transition-colors">
        <SlidersHorizontal size={14} /> Filter
      </button>

      <button className="no-drag flex items-center gap-2 bg-[var(--ft-surface)] border border-[var(--ft-border)] rounded-[var(--ft-radius-pill)] px-4 py-2.5 text-sm text-[var(--ft-text-secondary)] hover:border-[var(--ft-border-hover)] transition-colors">
        <ArrowUpDown size={14} /> Sort
      </button>

      {gpuName && (
        <button className="no-drag flex items-center gap-2 bg-[var(--ft-surface)] border border-[var(--ft-border)] rounded-[var(--ft-radius-pill)] px-4 py-2.5 text-sm text-[var(--ft-text-primary)] hover:border-[var(--ft-border-hover)] transition-colors">
          <MonitorSmartphone size={14} className="text-[var(--ft-text-muted)]" />
          {gpuName}
          <ChevronDown size={14} className="text-[var(--ft-text-muted)]" />
        </button>
      )}

      {driverVersion && (
        <span className="flex items-center gap-1.5 bg-[var(--ft-success-soft)] text-[var(--ft-success)] rounded-[var(--ft-radius-pill)] px-3.5 py-2.5 text-xs font-medium whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ft-success)]" />
          Driver {driverVersion}
        </span>
      )}
    </div>
  );
}
