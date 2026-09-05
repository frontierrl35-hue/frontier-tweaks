import { Sparkles } from 'lucide-react';

export function UpgradeButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="no-drag ft-pill-outline flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--ft-text-primary)] shrink-0"
    >
      <Sparkles size={14} className="text-[var(--ft-accent-2)]" /> Upgrade
    </button>
  );
}
