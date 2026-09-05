import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, Headphones, BookOpen, Gauge, ShieldCheck } from 'lucide-react';
import { UpgradeButton } from '../components/buttons/UpgradeButton';
import { WelcomeActionCard } from '../components/home/WelcomeActionCard';
import { PerformanceChart } from '../components/home/PerformanceChart';
import { QuickstartChecklist, type QuickstartItem } from '../components/home/QuickstartChecklist';
import { UpdatesSection } from '../components/home/UpdatesSection';
import { useTweakStore } from '../stores/tweakStore';
import { useAccountStore } from '../stores/accountStore';
import type { BackupRecord, SystemInfoSnapshot } from '../../shared/types';

const CATEGORIES = [
  { label: 'General', key: 'general' },
  { label: 'Hardware', key: 'hardware' },
  { label: 'Network', key: 'network' },
  { label: 'Debloat', key: 'debloat' },
  { label: 'Advanced', key: 'advanced' },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<SystemInfoSnapshot | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const { tweaks, statuses, loadTweaks } = useTweakStore();
  const { username } = useAccountStore();

  useEffect(() => {
    if (tweaks.length === 0) loadTweaks();
    window.frontier.system.getInfo().then((res) => {
      if (res.success) setInfo(res.data as SystemInfoSnapshot);
    });
    window.frontier.backups.list().then((res) => res.success && setBackups(res.data as BackupRecord[]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appliedCount = tweaks.filter((t) => statuses[t.id] === 'applied').length;
  const score = tweaks.length ? Math.round((appliedCount / tweaks.length) * 100) : 0;
  const appliedIn = (key: string) => tweaks.some((t) => t.category === key && statuses[t.id] === 'applied');

  const checklist: QuickstartItem[] = [
    { label: 'Create a backup', description: 'Back up your system settings for safety', done: backups.length > 0, to: '/backups' },
    { label: 'Apply a tweak', description: 'Enable tweaks to boost performance', done: appliedCount > 0, to: '/general' },
    { label: 'Clean your system files', description: 'Free up the clutter on your drive', done: appliedIn('debloat'), to: '/debloat' },
    { label: 'Debloat your system', description: 'Apply a service preset to remove useless services', done: appliedIn('debloat'), to: '/debloat' },
    { label: 'Optimize an app', description: 'Fine-tune settings for a specific game or app', done: appliedIn('advanced'), to: '/advanced' },
    { label: 'Tune your network', description: 'Reduce latency and improve throughput', done: appliedIn('network'), to: '/network' },
    { label: 'Optimize your hardware', description: 'Get the most out of your CPU and GPU', done: appliedIn('hardware'), to: '/hardware' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ft-text-primary)]">Welcome Back, {username}!</h1>
          <p className="text-sm text-[var(--ft-text-secondary)] mt-1.5">Ready to enhance your system performance?</p>
        </div>
        <UpgradeButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WelcomeActionCard
          icon={Power}
          title={String(backups.length)}
          subtitle="Backups found"
          ctaLabel="Create backup"
          tone="accent"
          onCta={() => navigate('/backups')}
        />
        <WelcomeActionCard
          icon={Headphones}
          title="Need help?"
          subtitle="Visit our dedicated support portal"
          ctaLabel="I need help"
          tone="success"
          onCta={() => navigate('/support')}
        />
        <WelcomeActionCard
          icon={BookOpen}
          title="How to use Guide"
          subtitle="Watch our Full tutorial video for Frontier Tweaks"
          ctaLabel="Watch Tutorial"
          tone="danger"
          onCta={() => navigate('/support')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2.6fr_1fr] gap-4 items-stretch">
        <PerformanceChart subtitle={info?.cpu.model ?? 'Detecting…'} />
        <QuickstartChecklist items={checklist} onNavigate={navigate} />
      </div>

      <UpdatesSection />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ft-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[var(--ft-accent-light)]">
            <Gauge size={16} />
            <span className="text-xs font-semibold">Optimization Score</span>
          </div>
          <div className="text-4xl font-bold text-[var(--ft-text-primary)]">{score}%</div>
          <div className="h-1.5 rounded-full bg-[var(--ft-border)] overflow-hidden">
            <div className="h-full" style={{ width: `${score}%`, background: 'var(--ft-gradient)' }} />
          </div>
          <p className="text-[11px] text-[var(--ft-text-muted)]">{appliedCount} of {tweaks.length} available tweaks applied</p>
        </div>

        <div className="ft-card p-5 flex flex-col gap-3 md:col-span-2">
          <div className="flex items-center gap-2 text-[var(--ft-success)]">
            <ShieldCheck size={16} />
            <span className="text-xs font-semibold">System Status</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-[var(--ft-text-secondary)]">
            <div>
              <div className="text-[var(--ft-text-muted)]">Windows</div>
              <div className="text-[var(--ft-text-primary)] font-medium mt-0.5">{info?.os.distro ?? 'Detecting…'}</div>
            </div>
            <div>
              <div className="text-[var(--ft-text-muted)]">Build</div>
              <div className="text-[var(--ft-text-primary)] font-medium mt-0.5">{info?.os.build ?? '—'}</div>
            </div>
            <div>
              <div className="text-[var(--ft-text-muted)]">Hostname</div>
              <div className="text-[var(--ft-text-primary)] font-medium mt-0.5">{info?.hostname ?? '—'}</div>
            </div>
            <div>
              <div className="text-[var(--ft-text-muted)]">Architecture</div>
              <div className="text-[var(--ft-text-primary)] font-medium mt-0.5">{info?.os.arch ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[var(--ft-text-primary)] mb-3">By category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map((c) => {
            const inCat = tweaks.filter((t) => t.category === c.key);
            const appliedInCat = inCat.filter((t) => statuses[t.id] === 'applied').length;
            return (
              <button key={c.key} onClick={() => navigate(`/${c.key}`)} className="ft-card ft-glow-on-hover no-drag p-4 text-left">
                <div className="text-xs text-[var(--ft-text-muted)]">{c.label}</div>
                <div className="text-lg font-semibold text-[var(--ft-text-primary)] mt-1">
                  {appliedInCat}/{inCat.length}
                </div>
                <div className="text-[11px] text-[var(--ft-text-muted)]">tweaks applied</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
