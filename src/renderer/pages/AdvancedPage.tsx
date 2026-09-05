import { useState } from 'react';
import { ShieldCheck, Cpu, HardDrive, Timer } from 'lucide-react';
import { CategoryPage } from '../components/layout/CategoryPage';
import { PageTabs, ComingSoonPanel, type PageTab } from '../components/layout/PageTabs';
import { AggressiveServicesProfile } from '../components/advanced/AggressiveServicesProfile';

const TABS: PageTab[] = [
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'msi', label: 'MSI Mode', icon: Cpu, badge: 'Soon' },
  { id: 'devices', label: 'Devices', icon: HardDrive, badge: 'Soon' },
  { id: 'timer', label: 'Timer Resolution', icon: Timer, badge: 'Soon' },
];

export default function AdvancedPage() {
  const [tab, setTab] = useState('security');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Advanced</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">
          Deeper system tuning for experienced users. Items with a red border weaken a security protection — read
          the warning before applying.
        </p>
      </div>

      <PageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'security' && (
        <div className="flex flex-col gap-6">
          <CategoryPage
            category="advanced"
            title="Security"
            subtitle="Kernel and OS security mitigations. Disabling these can meaningfully improve performance but reduces protection against exploits and malware."
          />
          <AggressiveServicesProfile />
        </div>
      )}
      {tab === 'msi' && (
        <ComingSoonPanel
          title="MSI Mode"
          description="Switching GPU/NIC interrupts to Message-Signaled Interrupts is planned but not implemented yet."
        />
      )}
      {tab === 'devices' && (
        <ComingSoonPanel
          title="Devices"
          description="A device manager view for driver-level power and performance tuning is planned but not implemented yet."
        />
      )}
      {tab === 'timer' && (
        <ComingSoonPanel
          title="Timer Resolution"
          description="A system timer resolution control (like the classic 0.5ms tick trick) is planned but not implemented yet."
        />
      )}
    </div>
  );
}
