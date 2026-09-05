import { Suspense } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from '../sidebar/Sidebar';
import { UpdateBanner } from '../system/UpdateBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--ft-bg)] text-[var(--ft-text-primary)]">
      <TitleBar />
      <UpdateBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Suspense fallback={<div className="p-8 text-sm text-[var(--ft-text-muted)]">Loading…</div>}>
            <div className="ft-page-enter p-8 max-w-6xl mx-auto">{children}</div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
