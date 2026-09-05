import { useEffect, useState } from 'react';
import { CircuitBoard, CheckCircle2, XCircle, HelpCircle, Info } from 'lucide-react';
import { Button } from '../components/buttons/Button';
import type { BiosCheckItem, BiosCheckState } from '../../shared/types';

const STATE_CONFIG: Record<BiosCheckState, { label: string; icon: typeof CheckCircle2; className: string }> = {
  enabled: { label: 'Enabled', icon: CheckCircle2, className: 'text-[var(--ft-success)] bg-[rgba(46,207,133,0.1)]' },
  disabled: { label: 'Disabled', icon: XCircle, className: 'text-[var(--ft-danger)] bg-[rgba(248,85,95,0.1)]' },
  'not-detectable': { label: 'Check in BIOS', icon: HelpCircle, className: 'text-[var(--ft-warning)] bg-[rgba(251,191,36,0.1)]' },
  unknown: { label: 'Unknown', icon: HelpCircle, className: 'text-[var(--ft-text-secondary)] bg-[var(--ft-surface-raised)]' },
};

export default function BiosPage() {
  const [items, setItems] = useState<BiosCheckItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const runCheck = () => {
    setLoading(true);
    window.frontier.bios.check().then((res) => {
      if (res.success) setItems(res.data as BiosCheckItem[]);
      setLoading(false);
    });
  };

  useEffect(runCheck, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">BIOS</h1>
          <p className="text-sm text-[var(--ft-text-secondary)] mt-1 max-w-2xl">
            Frontier Tweaks never flashes firmware or writes BIOS settings directly. This is a read-only check —
            control timer/firmware behavior to investigate configuration, then follow the instructions for anything
            that needs to change in your motherboard's own BIOS/UEFI interface.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={runCheck} loading={loading}>
          Re-run Check
        </Button>
      </div>

      <div className="ft-card p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[rgba(124,92,255,0.12)] flex items-center justify-center shrink-0">
          <CircuitBoard size={16} className="text-[var(--ft-accent-light)]" />
        </div>
        <p className="text-xs text-[var(--ft-text-secondary)] leading-relaxed">
          Safe BIOS Optimization Check — detects what Windows can genuinely read from firmware (virtualization,
          Secure Boot, the OS-side PCIe power policy) and is honest about what it can't (Resizable BAR, XMP/EXPO),
          pointing you to the right BIOS screen instead of guessing.
        </p>
      </div>

      {loading && !items ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ft-card p-5 h-28 animate-pulse bg-[#14141d]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(items ?? []).map((item) => {
            const cfg = STATE_CONFIG[item.state];
            const Icon = cfg.icon;
            return (
              <div key={item.id} className="ft-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">{item.name}</h3>
                    <p className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed">{item.description}</p>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${cfg.className}`}>
                    <Icon size={12} /> {cfg.label}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ft-text-muted)] leading-relaxed">{item.detail}</p>
                {item.manualInstructions && (
                  <div className="flex items-start gap-2 bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[8px] p-2.5">
                    <Info size={13} className="text-[var(--ft-accent-light)] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[var(--ft-text-secondary)] leading-relaxed">{item.manualInstructions}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
