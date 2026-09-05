import { useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { Button } from '../buttons/Button';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';

/** Only renders for the phases a user actually needs to act on or watch:
 *  an update is available, downloading, or ready to install. Silent on
 *  idle/checking/not-available/error — update checks are best-effort and
 *  should never interrupt someone mid-tweak. */
export function UpdateBanner() {
  const { status, download, install } = useUpdateStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  let text: string | null = null;
  let action: React.ReactNode = null;

  if (status.phase === 'available') {
    text = `Frontier Tweaks ${status.version ?? ''} is available.`;
    action = (
      <Button size="sm" variant="primary" onClick={() => download()}>
        Download
      </Button>
    );
  } else if (status.phase === 'downloading') {
    text = `Downloading update… ${status.percent ?? 0}%`;
  } else if (status.phase === 'downloaded') {
    text = `Frontier Tweaks ${status.version ?? ''} is ready to install.`;
    action = (
      <Button size="sm" variant="gradient" onClick={() => install()}>
        Restart &amp; Install
      </Button>
    );
  }

  if (!text) return null;

  return (
    <div className="no-drag flex items-center justify-between gap-3 px-4 py-2 bg-[var(--ft-accent-soft)] border-b border-[var(--ft-border)] text-xs text-[var(--ft-text-primary)]">
      <div className="flex items-center gap-2">
        <DownloadCloud size={14} className="text-[var(--ft-accent-light)]" />
        {text}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)] transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
