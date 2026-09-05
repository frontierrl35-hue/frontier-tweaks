import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../buttons/Button';

export function AdminGate() {
  const [relaunching, setRelaunching] = useState(false);

  const restartAsAdmin = async () => {
    setRelaunching(true);
    await window.frontier.system.relaunchElevated();
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--ft-bg)] text-center px-8 drag">
      <div className="ft-card no-drag w-[420px] p-8 flex flex-col items-center gap-4 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(251,191,36,0.12)] flex items-center justify-center">
          <ShieldAlert size={22} className="text-[var(--ft-warning)]" />
        </div>
        <h1 className="text-lg font-semibold text-[var(--ft-text-primary)]">Administrator privileges required</h1>
        <p className="text-sm text-[var(--ft-text-secondary)] leading-relaxed">
          Frontier Tweaks changes system services, registry keys, and Windows features that Windows only allows an
          elevated process to modify. Restart the app as Administrator to continue.
        </p>
        <Button variant="primary" className="w-full mt-2" loading={relaunching} onClick={restartAsAdmin}>
          Restart as Administrator
        </Button>
      </div>
    </div>
  );
}
