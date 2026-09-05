// Handles the desktop side of Discord sign-in: sending the user to the
// system browser, catching the custom-protocol redirect back, and
// periodically re-checking premium status with the backend (see
// ../../../server/README.md for the other half of this).
//
// Deliberately holds no Discord secrets — only an opaque session token the
// backend issued, which is meaningless without the backend to verify it.

import { shell, BrowserWindow } from 'electron';
import { logger } from '../utils/logger';
import { getAuthToken, setAuthToken, getLastAuthStatus, setLastAuthStatus } from './stateStore';
import { AUTH_SERVER_URL, AUTH_PROTOCOL } from '../../shared/authConfig';
import type { AuthStatus } from '../../shared/types';

const SIGNED_OUT: AuthStatus = { signedIn: false, premium: false };

let getWindow: (() => BrowserWindow | null) | null = null;

export function initAuthService(windowGetter: () => BrowserWindow | null) {
  getWindow = windowGetter;
  warmAuthServer();
}

/** Free-tier Render instances spin down after inactivity and take 50+
 *  seconds to wake back up on the next request. Firing a harmless /health
 *  ping the moment the app opens means the instance is usually already
 *  awake by the time someone actually clicks "Sign in", instead of them
 *  staring at a blank browser tab for a minute wondering if it's broken.
 *  Fire-and-forget: failures here are not shown to the user, since the
 *  real sign-in flow will simply retry the wake-up itself. */
function warmAuthServer() {
  fetch(`${AUTH_SERVER_URL}/health`, { signal: AbortSignal.timeout(60_000) }).catch(() => {
    // Ignored — startLogin()/refreshStatus() will surface any real problem.
  });
}

function broadcast(status: AuthStatus) {
  getWindow?.()?.webContents.send('auth:statusChanged', status);
}

/** Opens the system browser to start the OAuth flow. Deliberately does NOT
 *  use an in-app BrowserWindow for the Discord login form itself — the
 *  system browser lets people use saved passwords, passkeys, and 2FA apps
 *  normally, and avoids ever putting Discord credentials inside a window
 *  this app controls. */
export function startLogin() {
  shell.openExternal(`${AUTH_SERVER_URL}/auth/login`);
}

/** Called with the full `frontier-tweaks://auth?token=...` URL once the
 *  backend redirects the user's browser back into the app (see main.ts's
 *  protocol/second-instance wiring). */
export async function handleAuthCallback(url: string) {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get('token');
    if (!token) {
      logger.error('auth-callback-missing-token', { url });
      return;
    }
    await setAuthToken(token);
    const status = await refreshStatus();
    getWindow?.()?.focus();
    return status;
  } catch (err) {
    logger.error('auth-callback-error', { error: String(err) });
  }
}

/** Re-checks status with the backend (which re-checks the live Discord role
 *  every time — see server/index.js). Falls back to the last cached status,
 *  flagged `offline`, if the backend can't be reached, so a flaky network
 *  connection doesn't yank premium access away mid-session. */
export async function refreshStatus(): Promise<AuthStatus> {
  const token = await getAuthToken();
  if (!token) {
    await setLastAuthStatus(null);
    broadcast(SIGNED_OUT);
    return SIGNED_OUT;
  }

  try {
    const res = await fetch(`${AUTH_SERVER_URL}/auth/status?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) {
      // Session expired or was invalidated server-side — require a fresh login.
      await setAuthToken(null);
      await setLastAuthStatus(null);
      broadcast(SIGNED_OUT);
      return SIGNED_OUT;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const status: AuthStatus = {
      signedIn: true,
      discordId: data.discordId,
      username: data.username,
      avatar: data.avatar ?? null,
      premium: Boolean(data.premium),
      offline: Boolean(data.offline),
    };
    await setLastAuthStatus(status);
    broadcast(status);
    return status;
  } catch (err) {
    logger.error('auth-refresh-failed', { error: String(err) });
    const cached = await getLastAuthStatus();
    const fallback: AuthStatus = cached ? { ...cached, offline: true } : SIGNED_OUT;
    broadcast(fallback);
    return fallback;
  }
}

export async function getCachedStatus(): Promise<AuthStatus> {
  const cached = await getLastAuthStatus();
  return cached ?? SIGNED_OUT;
}

export async function logout() {
  await setAuthToken(null);
  await setLastAuthStatus(null);
  broadcast(SIGNED_OUT);
}

export { AUTH_PROTOCOL };
