import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Cpu,
  Trash2,
  Wifi,
  Wrench,
  CircuitBoard,
  Gamepad2,
  LifeBuoy,
  History,
  FolderOpen,
  LogOut,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import clsx from 'clsx';
import { APP_VERSION } from '../../../shared/types';
import { useAccountStore } from '../../stores/accountStore';

const GENERAL_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/backups', label: 'Backups & Fixes', icon: History },
  { to: '/resources', label: 'Resources', icon: FolderOpen },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

const TOOLS_NAV = [{ to: '/game-mode', label: 'Frontier Game Mode', icon: Gamepad2 }];

const OPTIMIZATIONS_NAV = [
  { to: '/general', label: 'General', icon: SlidersHorizontal },
  { to: '/hardware', label: 'Hardware', icon: Cpu },
  { to: '/debloat', label: 'Debloat', icon: Trash2 },
  { to: '/network', label: 'Network', icon: Wifi },
  { to: '/advanced', label: 'Advanced', icon: Wrench },
  { to: '/bios', label: 'BIOS', icon: CircuitBoard, badge: 'Supported' },
];

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: string };

function NavGroup({ label, items, tone }: { label?: string; items: NavItem[]; tone?: 'tool' }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium text-[var(--ft-text-muted)]">{label}</div>}
      {items.map(({ to, label: itemLabel, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              'group flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-150',
              isActive
                ? tone === 'tool'
                  ? 'bg-[var(--ft-accent-2-soft)] text-[var(--ft-text-primary)] shadow-[inset_0_0_0_1px_rgba(255,61,129,0.3)]'
                  : 'bg-[var(--ft-accent-soft)] text-[var(--ft-text-primary)] shadow-[inset_0_0_0_1px_rgba(124,92,255,0.25)]'
                : tone === 'tool'
                  ? 'text-[var(--ft-accent-2)] hover:bg-[var(--ft-surface-raised)]'
                  : 'text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)] hover:bg-[var(--ft-surface-raised)]'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={17}
                className={
                  tone === 'tool'
                    ? 'text-[var(--ft-accent-2)]'
                    : isActive
                      ? 'text-[var(--ft-accent-light)]'
                      : 'text-[var(--ft-text-muted)] group-hover:text-[var(--ft-text-secondary)]'
                }
              />
              <span className="font-medium flex-1">{itemLabel}</span>
              {badge && (
                <span className="text-[10px] font-medium text-[var(--ft-success)] bg-[var(--ft-success-soft)] px-2 py-0.5 rounded-full shrink-0">
                  {badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { signedIn, username, premium, loading, login, logout } = useAccountStore();

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--ft-border)] bg-[var(--ft-bg-raised)] flex flex-col py-4">
      <div className="px-5 pb-4 mb-1 border-b border-[var(--ft-border)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--ft-accent)] to-[var(--ft-accent-deep)] flex items-center justify-center text-white text-xs font-bold">
            F
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-wide">FRONTIER</div>
            <div className="text-[10px] text-[var(--ft-text-muted)] tracking-widest -mt-0.5">TWEAKS</div>
          </div>
        </div>
        <span className="text-[10px] font-medium text-[var(--ft-accent-light)] bg-[var(--ft-accent-soft)] px-2 py-1 rounded-full">
          v{APP_VERSION}
        </span>
      </div>

      <nav className="flex-1 px-3 flex flex-col overflow-y-auto">
        <NavGroup items={GENERAL_NAV} />
        <NavGroup label="Tools" items={TOOLS_NAV} tone="tool" />
        <NavGroup label="Optimizations" items={OPTIMIZATIONS_NAV} />
      </nav>

      <div className="px-3 pt-3 mt-1 border-t border-[var(--ft-border)]">
        {signedIn ? (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--ft-accent)] to-[var(--ft-accent-deep)] flex items-center justify-center shrink-0 text-white text-xs font-bold uppercase">
              {(username ?? '?').charAt(0)}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--ft-text-primary)] truncate">{username}</div>
              <div className={`text-[10px] ${premium ? 'text-[var(--ft-accent-light)]' : 'text-[var(--ft-text-muted)]'}`}>
                {premium ? 'Premium Tweaker' : 'Free User'}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="no-drag shrink-0 text-[var(--ft-text-muted)] hover:text-[var(--ft-text-secondary)] transition"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => login()}
            disabled={loading}
            className="no-drag w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] text-xs font-medium bg-[#5865F2] hover:bg-[#4a54d6] text-white transition disabled:opacity-60"
          >
            <FaDiscord size={14} />
            Sign in with Discord
          </button>
        )}
      </div>
    </aside>
  );
}
