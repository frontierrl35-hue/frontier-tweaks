import { useState } from 'react';
import { Sparkles, Cog, Trash2, Zap } from 'lucide-react';
import { CategoryPage } from '../components/layout/CategoryPage';
import { PageTabs, ComingSoonPanel, type PageTab } from '../components/layout/PageTabs';
import { BloatwareRemoval } from '../components/debloat/BloatwareRemoval';

const TABS: PageTab[] = [
  { id: 'cleaner', label: 'System Cleaner', icon: Sparkles },
  { id: 'services', label: 'Services', icon: Cog, badge: 'Soon' },
  { id: 'uninstall', label: 'Uninstall', icon: Trash2 },
  { id: 'autoruns', label: 'Autoruns', icon: Zap, badge: 'Soon' },
];

export default function DebloatPage() {
  const [tab, setTab] = useState('cleaner');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Debloat</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">
          Free up disk space and remove bloatware safely. These operations never touch your personal documents.
        </p>
      </div>

      <PageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'cleaner' && (
        <CategoryPage
          category="debloat"
          title="System Cleaner"
          subtitle="Clears temp files, the recycle bin, prefetch, update cache, and crash dumps. Nothing here touches your documents."
        />
      )}
      {tab === 'services' && (
        <ComingSoonPanel
          title="Services"
          description="Safe, reversible Windows service management (start/stop/disable with a rollback list) is planned but not implemented yet."
        />
      )}
      {tab === 'uninstall' && <BloatwareRemoval />}
      {tab === 'autoruns' && (
        <ComingSoonPanel
          title="Autoruns"
          description="A startup-program manager (enable/disable what launches at boot) is planned but not implemented yet."
        />
      )}
    </div>
  );
}
