import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';
import type { RemovableAppInfo, UninstallAppsSummary } from '../../shared/types';

/**
 * Curated list of built-in app package families that are safe to remove for
 * most users. Only well-documented, stable package family names are listed —
 * nothing guessed. Copilot is intentionally excluded here since its package
 * name is inconsistent across builds; it's handled via the registry policy
 * tweak in the General category instead.
 */
const REMOVABLE_APPS: Array<{ id: string; displayName: string; packageFamily: string }> = [
  { id: 'app-3dviewer', displayName: '3D Viewer', packageFamily: 'Microsoft.Microsoft3DViewer' },
  { id: 'app-alarms-clock', displayName: 'Alarms & Clock', packageFamily: 'Microsoft.WindowsAlarms' },
  { id: 'app-camera', displayName: 'Camera', packageFamily: 'Microsoft.WindowsCamera' },
  { id: 'app-clipchamp', displayName: 'Clipchamp', packageFamily: 'Clipchamp.Clipchamp' },
  { id: 'app-cortana', displayName: 'Cortana', packageFamily: 'Microsoft.549981C3F5F10' },
  { id: 'app-devhome', displayName: 'Dev Home', packageFamily: 'MicrosoftCorporationII.DevHome' },
  { id: 'app-family-safety', displayName: 'Family Safety', packageFamily: 'MicrosoftCorporationII.MicrosoftFamily' },
  { id: 'app-feedback-hub', displayName: 'Feedback Hub', packageFamily: 'Microsoft.WindowsFeedbackHub' },
  { id: 'app-gethelp', displayName: 'Get Help', packageFamily: 'Microsoft.GetHelp' },
  { id: 'app-getstarted', displayName: 'Tips', packageFamily: 'Microsoft.Getstarted' },
  { id: 'app-groove-music', displayName: 'Groove Music', packageFamily: 'Microsoft.ZuneMusic' },
  { id: 'app-mail-calendar', displayName: 'Mail and Calendar', packageFamily: 'microsoft.windowscommunicationsapps' },
  { id: 'app-maps', displayName: 'Maps', packageFamily: 'Microsoft.WindowsMaps' },
  { id: 'app-solitaire', displayName: 'Microsoft Solitaire Collection', packageFamily: 'Microsoft.MicrosoftSolitaireCollection' },
  { id: 'app-xbox-app', displayName: 'Xbox App', packageFamily: 'Microsoft.GamingApp' },
  { id: 'app-xbox-overlay', displayName: 'Xbox Game Bar', packageFamily: 'Microsoft.XboxGamingOverlay' },
  { id: 'app-xbox-identity', displayName: 'Xbox Identity Provider', packageFamily: 'Microsoft.XboxIdentityProvider' },
  { id: 'app-xbox-speech', displayName: 'Xbox Speech to Text Overlay', packageFamily: 'Microsoft.XboxSpeechToTextOverlay' },
  { id: 'app-xbox-tcui', displayName: 'Xbox Live In-Game UI', packageFamily: 'Microsoft.Xbox.TCUI' },
  { id: 'app-3dbuilder', displayName: '3D Builder', packageFamily: 'Microsoft.3DBuilder' },
  { id: 'app-movies-tv', displayName: 'Movies & TV', packageFamily: 'Microsoft.ZuneVideo' },
  { id: 'app-skype', displayName: 'Skype', packageFamily: 'Microsoft.SkypeApp' },
  { id: 'app-people', displayName: 'People', packageFamily: 'Microsoft.People' },
  { id: 'app-wallet', displayName: 'Wallet', packageFamily: 'Microsoft.Wallet' },
  { id: 'app-news', displayName: 'News (Microsoft Start)', packageFamily: 'Microsoft.BingNews' },
  { id: 'app-weather', displayName: 'Weather', packageFamily: 'Microsoft.BingWeather' },
  { id: 'app-quick-assist', displayName: 'Quick Assist', packageFamily: 'MicrosoftCorporationII.QuickAssist' },
  { id: 'app-todo', displayName: 'Microsoft To Do', packageFamily: 'Microsoft.Todos' },
  { id: 'app-widgets', displayName: 'Widgets', packageFamily: 'MicrosoftWindows.Client.WebExperience' },
  { id: 'app-teams', displayName: 'Microsoft Teams (Consumer)', packageFamily: 'MicrosoftTeams' },
  { id: 'app-power-automate', displayName: 'Power Automate Desktop', packageFamily: 'Microsoft.PowerAutomateDesktop' },
];

export function removableAppCatalog() {
  return REMOVABLE_APPS.map(({ id, displayName }) => ({ id, displayName }));
}

export async function listRemovableApps(): Promise<RemovableAppInfo[]> {
  const results: RemovableAppInfo[] = [];
  for (const app of REMOVABLE_APPS) {
    const script = `if (Get-AppxPackage -AllUsers -Name '${app.packageFamily}' -ErrorAction SilentlyContinue) { 'YES' } else { 'NO' }`;
    const res = await runPowerShell(script, 8000);
    results.push({ id: app.id, displayName: app.displayName, installed: res.success && res.stdout.trim() === 'YES' });
  }
  return results;
}

export async function uninstallApps(ids: string[]): Promise<UninstallAppsSummary> {
  const summary: UninstallAppsSummary = { total: 0, removed: 0, failed: 0, results: [] };
  for (const id of ids) {
    const app = REMOVABLE_APPS.find((a) => a.id === id);
    if (!app) continue;
    summary.total++;
    const script = `
      $pkg = Get-AppxPackage -AllUsers -Name '${app.packageFamily}' -ErrorAction SilentlyContinue
      if ($pkg) { $pkg | Remove-AppxPackage -AllUsers -ErrorAction Stop }
      Write-Output 'OK'
    `;
    const res = await runPowerShell(script, 20000);
    if (res.success) {
      summary.removed++;
      summary.results.push({ id, displayName: app.displayName, success: true, message: 'Removed.' });
    } else {
      summary.failed++;
      summary.results.push({ id, displayName: app.displayName, success: false, message: 'Could not remove — it may already be uninstalled or protected on this edition.' });
      logger.warn('appx-remove-failed', { id, error: res.stderr });
    }
  }
  return summary;
}
