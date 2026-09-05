import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PlayCircle,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Target,
  ShieldCheck,
  Sparkles,
  LayoutGrid,
  BatteryCharging,
} from 'lucide-react';
import { TweakCard } from '../cards/TweakCard';
import { Button } from '../buttons/Button';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import { ProgressModal } from '../progress/ProgressModal';
import { useCategoryTweaks } from '../../hooks/useCategoryTweaks';
import { useTweakStore } from '../../stores/tweakStore';
import type { TweakCategory, TweakSubcategory } from '../../../shared/types';

interface Props {
  category: TweakCategory;
  title: string;
  subtitle: string;
}

const SUBCATEGORY_ORDER: TweakSubcategory[] = ['core', 'privacy', 'qol', 'apps', 'powerplan'];
const SUBCATEGORY_LABEL: Record<TweakSubcategory, string> = {
  core: 'Core',
  privacy: 'Privacy',
  qol: 'QOL',
  apps: 'Apps',
  powerplan: 'Powerplan',
};
const SUBCATEGORY_ICON: Record<TweakSubcategory, typeof Target> = {
  core: Target,
  privacy: ShieldCheck,
  qol: Sparkles,
  apps: LayoutGrid,
  powerplan: BatteryCharging,
};

type FilterValue = 'all' | 'applied' | 'not-applied';
type SortValue = 'default' | 'name' | 'risk';

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All tweaks' },
  { value: 'applied', label: 'Applied' },
  { value: 'not-applied', label: 'Not applied' },
];
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'default', label: 'Default order' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'risk', label: 'Risk (low first)' },
];
const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;

/** Small dropdown used for both Filter and Sort — closes on outside click
 *  or on selecting an option. */
function MenuButton<T extends string>({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: typeof SlidersHorizontal;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <Icon size={14} /> {label}
      </Button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-20 w-44 py-1.5 bg-[var(--ft-surface-raised)] border border-[var(--ft-border)] rounded-[var(--ft-radius-md)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="no-drag w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left text-[var(--ft-text-secondary)] hover:bg-[var(--ft-surface-sunken)] hover:text-[var(--ft-text-primary)] transition"
            >
              {opt.label}
              {opt.value === value && <Check size={13} className="text-[var(--ft-accent-2)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryPage({ category, title, subtitle }: Props) {
  const { tweaks, statuses, busyId, apply, revert } = useCategoryTweaks(category);
  const { applyAll } = useTweakStore();
  const [confirmApplyAll, setConfirmApplyAll] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [sort, setSort] = useState<SortValue>('default');

  const availableSubcats = useMemo(
    () => SUBCATEGORY_ORDER.filter((sc) => tweaks.some((t) => t.subcategory === sc)),
    [tweaks]
  );
  const [tab, setTab] = useState<TweakSubcategory | null>(null);
  useEffect(() => {
    if (availableSubcats.length > 0 && (tab === null || !availableSubcats.includes(tab))) {
      setTab(availableSubcats[0]);
    }
    if (availableSubcats.length === 0 && tab !== null) setTab(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSubcats.join(',')]);

  const notApplied = tweaks.filter((t) => statuses[t.id] !== 'applied' && statuses[t.id] !== 'unsupported' && !t.dangerous);

  const visibleTweaks = useMemo(() => {
    let list = tweaks;
    if (tab) list = list.filter((t) => t.subcategory === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (filter !== 'all') {
      list = list.filter((t) => (filter === 'applied' ? statuses[t.id] === 'applied' : statuses[t.id] !== 'applied'));
    }
    if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'risk') {
      list = [...list].sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk]);
    }
    return list;
  }, [tweaks, tab, search, filter, sort, statuses]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--ft-text-secondary)] mt-1">{subtitle}</p>
        </div>
        {tweaks.length > 0 && (
          <Button
            variant="gradient"
            onClick={() => setConfirmApplyAll(true)}
            disabled={notApplied.length === 0}
          >
            <PlayCircle size={15} /> Apply All ({notApplied.length})
          </Button>
        )}
      </div>

      {availableSubcats.length > 0 && (
        <div className="flex items-center gap-1 bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[var(--ft-radius-md)] p-1 w-fit">
          {availableSubcats.map((sc) => {
            const SubIcon = SUBCATEGORY_ICON[sc];
            const active = tab === sc;
            return (
              <button
                key={sc}
                onClick={() => setTab(sc)}
                className={`no-drag flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-[var(--ft-radius-sm)] transition-all ${
                  active
                    ? 'bg-[var(--ft-surface-raised)] text-[var(--ft-text-primary)]'
                    : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)]'
                }`}
              >
                <SubIcon size={14} className={active ? 'text-[var(--ft-accent-2)]' : ''} />
                {SUBCATEGORY_LABEL[sc]}
              </button>
            );
          })}
        </div>
      )}

      {tweaks.length > 0 && (
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="no-drag w-full pl-8 pr-3 py-2 text-xs bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[var(--ft-radius-md)] text-[var(--ft-text-primary)] placeholder:text-[var(--ft-text-muted)] outline-none focus:border-[var(--ft-border-hover)] transition"
            />
          </div>
          <MenuButton label="Filter" icon={SlidersHorizontal} options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
          <MenuButton label="Sort" icon={ArrowUpDown} options={SORT_OPTIONS} value={sort} onChange={setSort} />
        </div>
      )}

      {tab && <h2 className="text-sm font-semibold text-[var(--ft-text-primary)] -mb-2">{SUBCATEGORY_LABEL[tab]}</h2>}

      {tweaks.length === 0 ? (
        <div className="ft-card p-10 text-center text-sm text-[var(--ft-text-muted)]">
          No tweaks in this category yet — this section is scaffolded for future additions.
        </div>
      ) : visibleTweaks.length === 0 ? (
        <div className="ft-card p-10 text-center text-sm text-[var(--ft-text-muted)]">
          No tweaks match your search or filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTweaks.map((tweak) => (
            <TweakCard
              key={tweak.id}
              tweak={tweak}
              status={statuses[tweak.id] ?? 'unknown'}
              busy={busyId === tweak.id}
              onApply={() => apply(tweak.id)}
              onRevert={() => revert(tweak.id)}
            />
          ))}
        </div>
      )}

      {confirmApplyAll && (
        <ConfirmationDialog
          title={`Apply all ${title} tweaks?`}
          message={`This will apply ${notApplied.length} tweak(s) one at a time. You can undo reversible ones individually afterward.`}
          confirmLabel="Apply All"
          onConfirm={() => {
            setConfirmApplyAll(false);
            applyAll(notApplied.map((t) => t.id));
          }}
          onCancel={() => setConfirmApplyAll(false)}
        />
      )}

      <ProgressModal />
    </div>
  );
}
