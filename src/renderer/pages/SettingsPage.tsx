import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { Button } from '../components/buttons/Button';
import { Toggle } from '../components/buttons/Toggle';
import { useUpdateStatus } from '../hooks/useUpdateStatus';
import { DISCORD_URL, APP_VERSION } from '../../shared/types';

function SettingRow({ label, description, control }: { label: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[var(--ft-border)] last:border-0">
      <div>
        <div className="text-sm text-[var(--ft-text-primary)] font-medium">{label}</div>
        <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">{description}</div>
      </div>
      {control}
    </div>
  );
}

function updateStatusLabel(phase: string, version?: string, percent?: number, message?: string): string {
  switch (phase) {
    case 'checking':
      return 'Checking…';
    case 'available':
      return `Update ${version ?? ''} available`;
    case 'downloading':
      return `Downloading… ${percent ?? 0}%`;
    case 'downloaded':
      return `Update ${version ?? ''} ready — restart to install`;
    case 'not-available':
      return 'You\u2019re up to date';
    case 'error':
      return message ?? 'Update check failed';
    default:
      return 'Not checked yet';
  }
}

function UpdatesSection() {
  const { status, check, download, install } = useUpdateStatus();
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };

  return (
    <section className="ft-card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)] mb-1">Updates</h2>
      <SettingRow
        label="Check for updates"
        description={updateStatusLabel(status.phase, status.version, status.percent, status.message)}
        control={
          status.phase === 'available' ? (
            <Button variant="primary" size="sm" onClick={() => download()}>
              Download
            </Button>
          ) : status.phase === 'downloaded' ? (
            <Button variant="gradient" size="sm" onClick={() => install()}>
              Restart &amp; Install
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={checking || status.phase === 'checking' || status.phase === 'downloading'}
              onClick={runCheck}
            >
              Check now
            </Button>
          )
        }
      />
    </section>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore();

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1">Configure how Frontier Tweaks looks and behaves.</p>
      </div>

      <section className="ft-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)] mb-1">General</h2>
        <SettingRow
          label="Launch on startup"
          description="Open Frontier Tweaks automatically when Windows starts."
          control={<Toggle checked={settings.launchOnStartup} onChange={(v) => settings.update({ launchOnStartup: v })} />}
        />
        <SettingRow
          label="Notifications"
          description="Show a notification when Apply All finishes."
          control={<Toggle checked={settings.notificationsEnabled} onChange={(v) => settings.update({ notificationsEnabled: v })} />}
        />
      </section>

      <section className="ft-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)] mb-1">Appearance</h2>
        <SettingRow
          label="Animations"
          description="Enable page transitions and hover effects."
          control={<Toggle checked={settings.animationsEnabled} onChange={(v) => settings.update({ animationsEnabled: v })} />}
        />
      </section>

      <section className="ft-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)] mb-1">Backups</h2>
        <SettingRow
          label="Backup location"
          description={settings.backupLocation}
          control={
            <Button variant="secondary" size="sm" disabled>
              Change
            </Button>
          }
        />
      </section>

      <UpdatesSection />

      <section className="ft-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)] mb-3">About</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--ft-text-primary)] font-medium">Frontier Tweaks</div>
            <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">Version {APP_VERSION}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.frontier.system.openExternal(DISCORD_URL)}>
            <ExternalLink size={13} /> Join Discord
          </Button>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--ft-border)]">
          <Button
            variant="danger"
            size="sm"
            onClick={() => settings.update({
              accentColor: 'var(--ft-accent)',
              animationsEnabled: true,
              launchOnStartup: false,
              notificationsEnabled: true,
            })}
          >
            Reset application settings
          </Button>
        </div>
      </section>
    </div>
  );
}
