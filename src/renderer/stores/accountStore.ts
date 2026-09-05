import { create } from 'zustand';
import type { AuthStatus } from '../../shared/types';

// Backed by real Discord sign-in (main process -> server/ -> Discord) as of
// authService.ts. `premium` reflects the live "Premium Tweaker" role check,
// re-verified by the backend on every refresh -- never just a locally-set
// flag. `init()` is called once from App on mount.
interface AccountState extends AuthStatus {
  loading: boolean;
  init: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set) => ({
  signedIn: false,
  premium: false,
  loading: true,

  init: () => {
    window.frontier.auth.getStatus().then((res) => {
      if (res.success && res.data) set({ ...res.data, loading: false });
      else set({ loading: false });
    });
    window.frontier.auth.refresh().then((res) => {
      if (res.success && res.data) set({ ...res.data, loading: false });
    });
    window.frontier.auth.onStatusChanged((status) => set({ ...status, loading: false }));
  },

  login: async () => {
    await window.frontier.auth.login();
  },

  logout: async () => {
    await window.frontier.auth.logout();
    set({ signedIn: false, premium: false, discordId: undefined, username: undefined, avatar: undefined });
  },
}));

/** Display name for the sidebar footer — falls back to a generic label
 *  while signed out or before the first status check resolves. */
export function accountDisplayName(state: AccountState): string {
  return state.signedIn ? (state.username ?? 'Discord User') : 'Not signed in';
}
