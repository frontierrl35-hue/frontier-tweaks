# Frontier Tweaks auth server

A ~250-line Express app that does the two things that can't happen inside
the Electron app itself: exchanging a Discord OAuth code (needs a client
secret) and checking whether a user has your **Premium Tweaker** role (needs
a bot token). Neither secret is ever shipped to end users.

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications -> **New Application**.
2. **OAuth2** tab -> note the **Client ID**, click **Reset Secret** to get a
   **Client Secret**. Put both in `.env`.
3. Still on **OAuth2** -> **Redirects** -> add:
   `https://your-backend.example.com/auth/callback` (whatever host you land
   on in step 3 below — you can come back and edit this after deploying).
4. **Bot** tab -> **Add Bot** -> **Reset Token** -> copy it into
   `DISCORD_BOT_TOKEN`. No privileged intents need to be enabled for this —
   the role check is a plain REST lookup, not a gateway connection.
5. **OAuth2 -> URL Generator** -> scope `bot`, no permissions needed beyond
   default -> use the generated URL to invite the bot into your own server
   (it just needs to be a member).

## 2. Get your guild + role IDs

In Discord: **User Settings -> Advanced -> Developer Mode** (toggle on).
Then:
- Right-click your server's icon -> **Copy Server ID** -> `DISCORD_GUILD_ID`
- **Server Settings -> Roles**, create a **Premium Tweaker** role if it
  doesn't exist yet, right-click it -> **Copy Role ID** ->
  `DISCORD_PREMIUM_ROLE_ID`

## 3. Deploy

Any place that runs Node 18+ works. Easiest options:

- **Render** (free tier fine to start): New -> Web Service -> point at this
  `server/` folder, build command `npm install`, start command `npm start`,
  add the env vars from `.env.example` in the dashboard.
- **Railway**: New Project -> Deploy from repo (or `railway up` from this
  folder) -> add the same env vars.
- Your own VPS: `npm install && npm start` behind a reverse proxy (Caddy/
  nginx) with HTTPS — Discord requires an https redirect URI.

Once deployed, note the public URL (e.g. `https://frontier-auth.onrender.com`)
and:
- Set `PUBLIC_BASE_URL` to that exact URL (no trailing slash).
- Go back to the Discord Developer Portal -> OAuth2 -> Redirects and make
  sure `https://frontier-auth.onrender.com/auth/callback` is listed exactly.
- Update `AUTH_SERVER_URL` in `../src/shared/authConfig.ts` to that same URL,
  then rebuild the app.

## 4. Test it

`curl https://your-backend.example.com/health` should return `{"ok":true}`.
Then in the app, click **Sign in with Discord** in the sidebar — it opens
your default browser, and after approving, your browser redirects back into
the desktop app automatically.

## How premium status stays current

The session token the app stores is good for 7 days, but every time the app
checks status (`/auth/status`) the server re-queries Discord live for that
user's current roles rather than trusting what was true at login. So if you
remove someone's Premium Tweaker role, they lose access the next time the
app refreshes (on launch, and periodically) — no need to revoke anything
server-side.
