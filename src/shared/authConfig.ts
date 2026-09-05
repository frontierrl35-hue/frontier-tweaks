// One value to edit once you've deployed the server/ backend (see
// server/README.md). Everything else — OAuth client id/secret, bot token,
// guild id, role id — lives only in the backend's environment, never here,
// since this file ships inside the app anyone can unzip and read.
export const AUTH_SERVER_URL = 'https://your-backend.example.com';

// Must exactly match the custom protocol registered in main.ts and in your
// Discord app's OAuth redirect isn't relevant here (the redirect goes to the
// backend, not this scheme) — this is only what the backend redirects the
// user's browser to once it has finished the Discord round trip.
export const AUTH_PROTOCOL = 'frontier-tweaks';
