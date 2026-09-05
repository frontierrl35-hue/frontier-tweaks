import { ExternalLink, FolderOpen, MessageCircle, FileText } from 'lucide-react';
import { Button } from '../components/buttons/Button';
import { DISCORD_URL, APP_VERSION } from '../../shared/types';

const FAQ = [
  {
    q: 'A tweak shows "Failed" — what do I do?',
    a: 'Click the failed item to see the exact error captured from the operation. Most failures mean the setting doesn\u2019t exist on your Windows edition/build, or the app isn\u2019t running as Administrator.',
  },
  {
    q: 'How do I undo everything?',
    a: 'Go to Backups & Fixes and restore your most recent tweak-state backup, or restore the "Before Frontier Tweaks" restore point created on first launch.',
  },
  {
    q: 'Why does the app need Administrator rights?',
    a: 'Almost every tweak modifies Windows services, HKLM registry keys, or system features that Windows only allows an elevated process to change.',
  },
  {
    q: 'Is it safe to use Apply All?',
    a: 'Yes — Apply All processes tweaks one at a time and keeps going even if one fails, so a single failure never stops the rest or crashes the app.',
  },
];

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Frontier Tweaks Support</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">Get help, report issues, and find quick answers.</p>
      </div>

      <section className="ft-card p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[12px] bg-[rgba(88,101,242,0.15)] flex items-center justify-center">
            <MessageCircle size={20} className="text-[var(--ft-accent)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">Community / Discord</div>
            <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">Get real-time help from the Frontier Tweaks community.</div>
          </div>
        </div>
        <Button variant="primary" onClick={() => window.frontier.system.openExternal(DISCORD_URL)}>
          <ExternalLink size={14} /> Open Discord
        </Button>
      </section>

      <section className="ft-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={15} className="text-[var(--ft-accent-light)]" />
          <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Troubleshooting</h2>
        </div>
        <div className="flex flex-col divide-y divide-[var(--ft-border)]">
          {FAQ.map((item, i) => (
            <div key={i} className="py-3.5 first:pt-0 last:pb-0">
              <div className="text-sm text-[var(--ft-text-primary)] font-medium">{item.q}</div>
              <div className="text-xs text-[var(--ft-text-secondary)] mt-1 leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ft-card p-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--ft-text-primary)]">Frontier Tweaks Logs</div>
          <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">Version {APP_VERSION} — attach these logs when reporting an issue on Discord.</div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.frontier.system.openLogsFolder()}>
          <FolderOpen size={13} /> Open Logs Folder
        </Button>
      </section>
    </div>
  );
}
