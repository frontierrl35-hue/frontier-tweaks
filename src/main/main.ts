import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc';
import { initUpdater } from './services/updaterService';
import { initAuthService, handleAuthCallback, refreshStatus, AUTH_PROTOCOL } from './services/authService';
import { logger } from './utils/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Global crash guards. A failed tweak or a rejected promise anywhere in the
// main process must NEVER take the whole app down.
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  logger.error('uncaught-exception', { error: String(err), stack: err?.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled-rejection', { reason: String(reason) });
});

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// Discord sign-in redirect handling. The auth server (see server/) sends the
// user's browser to `frontier-tweaks://auth?token=...` once login completes.
// Windows launches a *second* instance of the app to handle a custom-protocol
// URL, so we grab the single-instance lock and forward the URL to the
// already-running instance instead. macOS instead fires 'open-url' on the
// existing instance directly.
// ---------------------------------------------------------------------------
function extractAuthUrl(argv: string[]): string | null {
  return argv.find((a) => a.startsWith(`${AUTH_PROTOCOL}://`)) ?? null;
}

if (!app.isDefaultProtocolClient(AUTH_PROTOCOL)) {
  app.setAsDefaultProtocolClient(AUTH_PROTOCOL);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = extractAuthUrl(argv);
    if (url) handleAuthCallback(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith(`${AUTH_PROTOCOL}://`)) handleAuthCallback(url);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1040,
    minHeight: 680,
    frame: false,
    backgroundColor: '#0D0D13',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  // Avoid a flash-of-white on startup — reveal only once the renderer has
  // painted its first frame.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return mainWindow;
}

function registerWindowControlIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  mainWindow?.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow?.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return; // already quitting; avoid flashing a window first

  // Lock down a strict CSP in production. In dev, Vite's HMR client relies
  // on eval-based module execution — without 'unsafe-eval' here the page's
  // script is silently blocked by the browser and the window renders blank
  // with no error dialog, which is exactly what a stricter-than-necessary
  // dev CSP looks like from the outside.
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const csp = isDev
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws: http://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*"
    : "default-src 'self' 'unsafe-inline' data:; script-src 'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  createWindow();
  registerWindowControlIpc();
  registerIpcHandlers(() => mainWindow);
  initUpdater(() => mainWindow);

  initAuthService(() => mainWindow);
  // Covers the (Windows) case where the app wasn't already running and the
  // OS launched it fresh with the callback URL as an argv entry, rather than
  // routing through 'second-instance'.
  const launchUrl = extractAuthUrl(process.argv);
  if (launchUrl) handleAuthCallback(launchUrl);
  // Always re-verify with the backend on startup so a role removed since the
  // last session is reflected immediately rather than after the cached
  // value's next scheduled refresh.
  refreshStatus();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
