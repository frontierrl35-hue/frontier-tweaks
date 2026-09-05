// Minimal Discord OAuth + role-check backend for Frontier Tweaks.
//
// Why this has to exist at all: Discord OAuth needs a client secret to
// exchange an auth code for an access token, and a bot token to look up a
// user's roles in your guild. Neither of those can ever live inside the
// Electron app itself -- anyone who downloads Frontier Tweaks can unzip the
// installer and read any string baked into it. This tiny server is the only
// thing that holds those secrets. It does three jobs:
//
//   1. GET  /auth/login      -> redirect the user's browser to Discord
//   2. GET  /auth/callback   -> exchange the code, check their roles,
//                               hand back a signed session token via a
//                               custom-protocol redirect the desktop app
//                               is registered to catch
//   3. GET  /auth/status     -> given a session token, re-check their roles
//                               live and report current premium status
//
// Deploy this anywhere that can run Node (Render, Railway, Fly.io, a small
// VPS, etc). See README.md in this folder for step-by-step setup.

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_PREMIUM_ROLE_ID,
  SESSION_SECRET,
  PUBLIC_BASE_URL,
  PORT = 3000,
} = process.env;

const REQUIRED_VARS = {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_PREMIUM_ROLE_ID,
  SESSION_SECRET,
  PUBLIC_BASE_URL,
};
for (const [name, value] of Object.entries(REQUIRED_VARS)) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}. See .env.example.`);
    process.exit(1);
  }
}

const AUTH_PROTOCOL = 'frontier-tweaks';
const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/callback`;
const SESSION_TTL = '7d';

const app = express();

// In-memory CSRF state for the OAuth `state` param. A desktop app doing a
// single interactive login doesn't need anything sturdier than this -- state
// entries expire on their own after a couple minutes.
const pendingStates = new Map();
function makeState() {
  const state = require('node:crypto').randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());
  setTimeout(() => pendingStates.delete(state), 5 * 60 * 1000);
  return state;
}
function consumeState(state) {
  const ok = pendingStates.has(state);
  pendingStates.delete(state);
  return ok;
}

/** Looks up whether a Discord user currently has the premium role in your
 *  guild. Uses the bot token against the plain REST guild-member endpoint --
 *  no gateway connection or privileged intent needed for a one-off lookup. */
async function checkPremiumRole(discordUserId) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
    {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        'User-Agent': 'FrontierTweaksAuth (https://frontier-tweaks-1.onrender.com, 1.0)',
      },
    }
  );
  if (res.status === 404) {
    // User isn't a member of the guild (anymore, or never joined).
    return false;
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Discord member lookup failed: ${res.status} ${body}`);
  }
  const member = await res.json();
  return Array.isArray(member.roles) && member.roles.includes(DISCORD_PREMIUM_ROLE_ID);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// TEMPORARY diagnostic route — hits Discord's lightest, fully unauthenticated
// endpoint to check if this server's outbound IP is broadly rate-limited by
// Cloudflare, or if it's specific to the heavier /oauth2/token endpoint.
// Safe to delete once we've diagnosed the 429s.
app.get('/debug/discord-ping', async (_req, res) => {
  try {
    const r = await fetch('https://discord.com/api/v10/gateway', {
      headers: { 'User-Agent': 'FrontierTweaksAuth (https://frontier-tweaks-1.onrender.com, 1.0)' },
    });
    const body = (await r.text()).slice(0, 300);
    res.json({ status: r.status, body });
  } catch (err) {
    res.json({ error: String(err) });
  }
});

app.get('/auth/login', (_req, res) => {
  const state = makeState();
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(errorPage('Discord sign-in was cancelled.'));
  }
  if (!code || !state || !consumeState(String(state))) {
    return res.status(400).send(errorPage('This sign-in link is invalid or expired. Go back to the app and try again.'));
  }

  try {
    const DISCORD_UA = 'FrontierTweaksAuth (https://frontier-tweaks-1.onrender.com, 1.0)';

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': DISCORD_UA,
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      const body = (await tokenRes.text()).slice(0, 300);
      throw new Error(`token exchange failed: ${tokenRes.status} ${body}`);
    }
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': DISCORD_UA,
      },
    });
    if (!userRes.ok) {
      const body = (await userRes.text()).slice(0, 300);
      throw new Error(`identify failed: ${userRes.status} ${body}`);
    }
    const user = await userRes.json();

    const premium = await checkPremiumRole(user.id);

    const session = jwt.sign(
      { sub: user.id, username: `${user.username}`, avatar: user.avatar ?? null, premium },
      SESSION_SECRET,
      { expiresIn: SESSION_TTL }
    );

    const redirectUrl = `${AUTH_PROTOCOL}://auth?token=${encodeURIComponent(session)}`;
    res.send(successPage(redirectUrl, user.username));
  } catch (err) {
    console.error('auth/callback error:', err);
    res.status(500).send(errorPage('Something went wrong talking to Discord. Try again in a moment.'));
  }
});

app.get('/auth/status', async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing token.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, SESSION_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please sign in again.' });
  }

  try {
    // Re-check live rather than trusting whatever premium value was baked
    // into the token at login time, so a role removed mid-week takes effect
    // on the next check instead of only after the 7-day token expires.
    const premium = await checkPremiumRole(payload.sub);
    res.json({
      success: true,
      discordId: payload.sub,
      username: payload.username,
      avatar: payload.avatar,
      premium,
    });
  } catch (err) {
    console.error('auth/status role-check error:', err);
    // Discord's API hiccuping shouldn't instantly de-premium someone --
    // fall back to what the session token already says, flagged as stale.
    res.json({
      success: true,
      discordId: payload.sub,
      username: payload.username,
      avatar: payload.avatar,
      premium: payload.premium,
      offline: true,
    });
  }
});

function successPage(redirectUrl, username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signed in</title>
  <style>body{font-family:-apple-system,Segoe UI,sans-serif;background:#0D0D13;color:#fff;
  display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{text-align:center;max-width:360px}
  a.btn{display:inline-block;margin-top:16px;padding:10px 18px;background:#7C5CFF;color:#fff;
  border-radius:8px;text-decoration:none;font-weight:600}</style></head>
  <body><div class="card"><h2>Signed in as ${escapeHtml(username)}</h2>
  <p>You can close this window and go back to Frontier Tweaks.</p>
  <a class="btn" href="${redirectUrl}">Return to app</a></div>
  <script>window.location.href = ${JSON.stringify(redirectUrl)};</script>
  </body></html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-in failed</title>
  <style>body{font-family:-apple-system,Segoe UI,sans-serif;background:#0D0D13;color:#fff;
  display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{text-align:center;max-width:360px}</style></head>
  <body><div class="card"><h2>Sign-in failed</h2><p>${escapeHtml(message)}</p></div></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

app.listen(PORT, () => {
  console.log(`Frontier Tweaks auth server listening on :${PORT}`);
});
