import type { LucideIcon } from 'lucide-react';
import { MonitorSmartphone, Cpu, MemoryStick, Mouse, HardDrive } from 'lucide-react';

export type HardwareTab = 'gpu' | 'cpu' | 'ram' | 'peripherals' | 'storage';

const TABS: { id: HardwareTab; label: string; icon: LucideIcon }[] = [
  { id: 'gpu', label: 'GPU', icon: MonitorSmartphone },
  { id: 'cpu', label: 'CPU', icon: Cpu },
  { id: 'ram', label: 'RAM', icon: MemoryStick },
  { id: 'peripherals', label: 'Peripherals', icon: Mouse },
  { id: 'storage', label: 'Storage', icon: HardDrive },
];

interface Props {
  active: HardwareTab;
  onChange: (tab: HardwareTab) => void;
}

export function HardwareTabs({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-6 border-b border-[var(--ft-border)]">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`no-drag flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative ${
              isActive ? 'text-[var(--ft-text-primary)]' : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)]'
            }`}
          >
            <Icon size={15} />
            {label}
            {isActive && (
              <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-[var(--ft-text-primary)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
