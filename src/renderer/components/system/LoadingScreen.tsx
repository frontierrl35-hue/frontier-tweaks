import { useEffect, useState } from 'react';

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 18 + 6);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 260);
        }
        return next;
      });
    }, 140);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--ft-bg)] drag">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--ft-accent)] to-[var(--ft-accent-deep)] flex items-center justify-center shadow-[0_0_40px_-8px_rgba(124,92,255,0.55)]">
          <span className="text-white font-bold text-xl">F</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-wide text-[var(--ft-text-primary)]">FRONTIER TWEAKS</h1>
          <p className="text-xs text-[var(--ft-text-muted)] mt-1">Loading...</p>
        </div>
        <div className="w-56 h-1 rounded-full bg-[var(--ft-border)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ft-accent)] to-[var(--ft-accent-light)] transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
