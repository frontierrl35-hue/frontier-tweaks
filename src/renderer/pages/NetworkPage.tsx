import { useState } from 'react';
import { Wifi, ListOrdered, Settings2, Gauge } from 'lucide-react';
import { CategoryPage } from '../components/layout/CategoryPage';
import { PageTabs, ComingSoonPanel, type PageTab } from '../components/layout/PageTabs';
import { NetworkPriority } from '../components/network/NetworkPriority';

const TABS: PageTab[] = [
  { id: 'tweaks', label: 'Tweaks', icon: Wifi },
  { id: 'priority', label: 'Network Priority', icon: ListOrdered },
  { id: 'adapter', label: 'Adapter Tuner', icon: Settings2, badge: 'Soon' },
  { id: 'bufferbloat', label: 'Bufferbloat', icon: Gauge, badge: 'Soon' },
];

export default function NetworkPage() {
  const [tab, setTab] = useState('tweaks');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Network</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">
          DNS, IPv6, and network stack tuning. Some operations briefly interrupt connectivity.
        </p>
      </div>

      <PageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'tweaks' && (
        <CategoryPage
          category="network"
          title="Tweaks"
          subtitle="DNS, IPv6, and TCP stack tuning. Some operations briefly interrupt connectivity."
        />
      )}
      {tab === 'priority' && <NetworkPriority />}
      {tab === 'adapter' && (
        <ComingSoonPanel
          title="Adapter Tuner"
          description="Per-adapter driver setting tuning (interrupt moderation, offloads) is planned but not implemented yet."
        />
      )}
      {tab === 'bufferbloat' && (
        <ComingSoonPanel
          title="Bufferbloat"
          description="A bufferbloat test and QoS-based fix is planned but not implemented yet."
        />
      )}
    </div>
  );
}
