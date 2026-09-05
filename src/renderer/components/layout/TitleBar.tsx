import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Square, X, Copy, Settings, ShieldCheck } from 'lucide-react';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [elevated, setElevated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.frontier.window.isMaximized().then(setMaximized);
    const unsubscribe = window.frontier.window.onMaximizedChange(setMaximized);
    window.frontier.system.isElevated().then((res) => {
      if (res.success) setElevated(Boolean(res.data));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="h-10 flex items-center justify-between drag select-none bg-[var(--ft-bg-raised)] border-b border-[var(--ft-border)]">
      <div className="pl-4 flex items-center gap-2 text-xs font-medium text-[var(--ft-text-muted)] tracking-wide">
        <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[var(--ft-accent)] to-[var(--ft-accent-deep)]" />
        FRONTIER TWEAKS
        {elevated && (
          <span className="no-drag flex items-center gap-1 ml-2 text-[10px] text-[var(--ft-success)] bg-[var(--ft-success-soft)] px-1.5 py-0.5 rounded-full">
            <ShieldCheck size={10} /> Administrator
          </span>
        )}
      </div>
      <div className="flex h-full no-drag">
        <button
          aria-label="Settings"
          onClick={() => navigate('/settings')}
          className="w-11 h-full flex items-center justify-center text-[var(--ft-text-secondary)] hover:bg-[var(--ft-surface-raised)] transition-colors"
        >
          <Settings size={14} />
        </button>
        <button
          aria-label="Minimize"
          onClick={() => window.frontier.window.minimize()}
          className="w-11 h-full flex items-center justify-center text-[var(--ft-text-secondary)] hover:bg-[var(--ft-surface-raised)] transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          aria-label="Maximize"
          onClick={() => window.frontier.window.maximizeToggle()}
          className="w-11 h-full flex items-center justify-center text-[var(--ft-text-secondary)] hover:bg-[var(--ft-surface-raised)] transition-colors"
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          aria-label="Close"
          onClick={() => window.frontier.window.close()}
          className="w-11 h-full flex items-center justify-center text-[var(--ft-text-secondary)] hover:bg-[var(--ft-danger)] hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
