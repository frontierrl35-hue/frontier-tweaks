import { FolderOpen, ExternalLink } from 'lucide-react';
import { DISCORD_URL } from '../../shared/types';

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Resources</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">Guides, community links, and other places to learn more.</p>
      </div>

      <div className="ft-card p-10 flex flex-col items-center text-center gap-3">
        <div className="w-11 h-11 rounded-[12px] bg-[var(--ft-accent-soft)] flex items-center justify-center">
          <FolderOpen size={20} className="text-[var(--ft-accent-light)]" />
        </div>
        <p className="text-sm text-[var(--ft-text-muted)] max-w-sm">
          This section is scaffolded for future additions — guides, changelogs, and community resources will live here.
        </p>
        <button
          onClick={() => window.frontier.system.openExternal(DISCORD_URL)}
          className="no-drag flex items-center gap-1.5 text-xs font-medium text-[var(--ft-accent-light)] hover:text-[var(--ft-text-primary)] mt-1"
        >
          Join the Discord for tips <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
