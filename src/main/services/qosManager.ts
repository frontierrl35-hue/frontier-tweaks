import { dialog, type BrowserWindow } from 'electron';
import { runPowerShell } from '../utils/exec';
import { logger } from '../utils/logger';

export interface QosPolicyInfo {
  name: string;
  appPath: string;
}

const POLICY_PREFIX = 'FrontierTweaks-';

export async function pickExecutable(win: BrowserWindow | null): Promise<string | null> {
  const result = await dialog.showOpenDialog(win ?? undefined as unknown as BrowserWindow, {
    title: 'Select an application',
    properties: ['openFile'],
    filters: [{ name: 'Applications', extensions: ['exe'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/** Escapes a value for safe interpolation inside a single-quoted PowerShell string. */
function psQuote(value: string): string {
  return value.replace(/'/g, "''");
}

export async function listQosPolicies(): Promise<QosPolicyInfo[]> {
  const script = `
    Get-NetQosPolicy -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like '${POLICY_PREFIX}*' } |
      ForEach-Object { "$($_.Name)|$($_.AppPathNameMatchCondition)" }
  `;
  const res = await runPowerShell(script, 10000);
  if (!res.success || !res.stdout.trim()) return [];
  return res.stdout
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, appPath] = line.split('|');
      return { name: name.replace(POLICY_PREFIX, ''), appPath: appPath ?? '' };
    });
}

export async function createQosPolicy(appPath: string): Promise<{ success: boolean; message: string }> {
  const fileName = appPath.split(/[/\\]/).pop() ?? appPath;
  const policyName = `${POLICY_PREFIX}${fileName}`.slice(0, 128);
  const script = `
    Remove-NetQosPolicy -Name '${psQuote(policyName)}' -Confirm:$false -ErrorAction SilentlyContinue
    New-NetQosPolicy -Name '${psQuote(policyName)}' -AppPathNameMatchCondition '${psQuote(appPath)}' -DSCPAction 46 -NetworkProfile All -ErrorAction Stop
    Write-Output 'OK'
  `;
  const res = await runPowerShell(script, 15000);
  if (res.success) return { success: true, message: `Priority policy created for ${fileName}.` };
  logger.warn('qos-create-failed', { appPath, error: res.stderr });
  return { success: false, message: 'Could not create the QoS policy for this executable.' };
}

export async function removeQosPolicy(fileName: string): Promise<{ success: boolean; message: string }> {
  const policyName = `${POLICY_PREFIX}${fileName}`.slice(0, 128);
  const res = await runPowerShell(`Remove-NetQosPolicy -Name '${psQuote(policyName)}' -Confirm:$false -ErrorAction Stop; Write-Output 'OK'`, 10000);
  if (res.success) return { success: true, message: 'Priority policy removed.' };
  return { success: false, message: 'Could not remove the policy.' };
}
