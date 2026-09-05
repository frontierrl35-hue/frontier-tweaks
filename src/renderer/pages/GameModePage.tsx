import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Search, Power, CheckCircle2, Activity } from 'lucide-react';
import { Button } from '../components/buttons/Button';
import type { DetectedGame, GameModeStatus } from '../../shared/types';

export default function GameModePage() {
  const [status, setStatus] = useState<GameModeStatus>({ enabled: false, detectedGame: null, actionsApplied: [] });
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState<DetectedGame | null | 'none'>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = () => window.frontier.gameMode.status().then((res) => res.success && setStatus(res.data as GameModeStatus));

  useEffect(() => {
    refreshStatus();
    // Poll while Game Mode is on so the UI reflects the game exiting.
    pollRef.current = setInterval(refreshStatus, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const autoDetect = async () => {
    setScanning(true);
    const res = await window.frontier.gameMode.detect();
    setLastScan(res.success ? ((res.data as DetectedGame | null) ?? 'none') : 'none');
    setScanning(false);
  };

  const toggleGameMode = async () => {
    setBusy(true);
    try {
      if (status.enabled) {
        const res = await window.frontier.gameMode.disable();
        if (res.success) setStatus(res.data as GameModeStatus);
      } else {
        const res = await window.frontier.gameMode.enable();
        if (res.success) setStatus(res.data as GameModeStatus);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Frontier Game Mode</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] mt-1 max-w-2xl">
          A temporary, fully reversible mode — not a permanent optimizer. It detects the game you're running, applies
          a couple of small adjustments while it's open, and puts everything back the moment you turn it off or the
          game exits. No memory injection, no anti-cheat interaction, ever.
        </p>
      </div>

      <div className="ft-card p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-[12px] flex items-center justify-center ${
                status.enabled ? 'bg-[rgba(46,207,133,0.12)]' : 'bg-[rgba(124,92,255,0.12)]'
              }`}
            >
              <Gamepad2 size={20} className={status.enabled ? 'text-[var(--ft-success)]' : 'text-[var(--ft-accent-light)]'} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                Game Mode is {status.enabled ? 'ON' : 'OFF'}
              </div>
              <div className="text-xs text-[var(--ft-text-muted)] mt-0.5">
                {status.enabled && status.detectedGame
                  ? `Optimizing for ${status.detectedGame.displayName}`
                  : status.enabled
                    ? 'Enabled — no known game currently detected'
                    : 'Toggle on while you play to apply temporary optimizations'}
              </div>
            </div>
          </div>
          <Button variant={status.enabled ? 'danger' : 'gradient'} onClick={toggleGameMode} loading={busy}>
            <Power size={14} /> {status.enabled ? 'Turn Off' : 'Turn On'}
          </Button>
        </div>

        {status.enabled && status.actionsApplied.length > 0 && (
          <div className="border-t border-[var(--ft-border)] pt-4 flex flex-col gap-2">
            <div className="text-xs font-semibold text-[var(--ft-text-muted)] uppercase tracking-wide">Active adjustments</div>
            {status.actionsApplied.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[var(--ft-text-secondary)]">
                <CheckCircle2 size={13} className="text-[var(--ft-success)] shrink-0" /> {a}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ft-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ft-text-primary)]">Auto Detect Game</h2>
            <p className="text-xs text-[var(--ft-text-muted)] mt-1">Scan running processes against Frontier's known game list.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={autoDetect} loading={scanning}>
            <Search size={13} /> Scan Now
          </Button>
        </div>

        {lastScan && (
          <div className="flex items-center gap-2 text-xs bg-[var(--ft-surface-sunken)] border border-[var(--ft-border)] rounded-[8px] p-3">
            <Activity size={13} className={lastScan !== 'none' ? 'text-[var(--ft-success)]' : 'text-[var(--ft-text-muted)]'} />
            {lastScan === 'none' ? (
              <span className="text-[var(--ft-text-muted)]">No recognized game process is currently running.</span>
            ) : (
              <span className="text-[var(--ft-text-primary)]">
                Detected <span className="font-medium">{lastScan.displayName}</span> (PID {lastScan.pid})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
