import { contextBridge, ipcRenderer } from 'electron';
import type { AuthStatus, OperationResult, ProgressUpdate, UpdateStatusPayload, UsageSnapshot } from '../shared/types';

// Only these channels are reachable from the renderer. Nothing else on
// ipcRenderer is exposed, and no Node globals (fs, child_process, require)
// cross this boundary.

const windowControls = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, val: boolean) => cb(val);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
};

const system = {
  getInfo: () => ipcRenderer.invoke('system:getInfo') as Promise<OperationResult>,
  getUsage: () => ipcRenderer.invoke('system:getUsage') as Promise<OperationResult<UsageSnapshot>>,
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url) as Promise<OperationResult>,
  openLogsFolder: () => ipcRenderer.invoke('system:openLogsFolder') as Promise<OperationResult>,
  isElevated: () => ipcRenderer.invoke('system:isElevated') as Promise<OperationResult<boolean>>,
  relaunchElevated: () => ipcRenderer.invoke('system:relaunchElevated') as Promise<OperationResult>,
};

const bios = {
  check: () => ipcRenderer.invoke('bios:check') as Promise<OperationResult>,
};

const gameMode = {
  detect: () => ipcRenderer.invoke('gameMode:detect') as Promise<OperationResult>,
  status: () => ipcRenderer.invoke('gameMode:status') as Promise<OperationResult>,
  enable: () => ipcRenderer.invoke('gameMode:enable') as Promise<OperationResult>,
  disable: () => ipcRenderer.invoke('gameMode:disable') as Promise<OperationResult>,
};

const fixes = {
  list: () => ipcRenderer.invoke('fixes:list') as Promise<OperationResult>,
  run: (id: string) => ipcRenderer.invoke('fixes:run', id) as Promise<OperationResult>,
};

const hardware = {
  getInfo: () => ipcRenderer.invoke('hardware:getInfo') as Promise<OperationResult>,
};

const tweaks = {
  list: () => ipcRenderer.invoke('tweaks:list') as Promise<OperationResult>,
  getStatuses: () => ipcRenderer.invoke('tweaks:getStatuses') as Promise<OperationResult>,
  apply: (id: string) => ipcRenderer.invoke('tweaks:apply', id) as Promise<OperationResult>,
  revert: (id: string) => ipcRenderer.invoke('tweaks:revert', id) as Promise<OperationResult>,
  applyAll: (ids: string[]) => ipcRenderer.invoke('tweaks:applyAll', ids) as Promise<OperationResult>,
  onProgress: (cb: (update: ProgressUpdate) => void) => {
    const listener = (_e: unknown, update: ProgressUpdate) => cb(update);
    ipcRenderer.on('tweaks:progress', listener);
    return () => ipcRenderer.removeListener('tweaks:progress', listener);
  },
};

const backups = {
  list: () => ipcRenderer.invoke('backups:list') as Promise<OperationResult>,
  create: (name: string) => ipcRenderer.invoke('backups:create', name) as Promise<OperationResult>,
  restore: (id: string) => ipcRenderer.invoke('backups:restore', id) as Promise<OperationResult>,
  delete: (id: string) => ipcRenderer.invoke('backups:delete', id) as Promise<OperationResult>,
  listRestorePoints: () => ipcRenderer.invoke('backups:listRestorePoints') as Promise<OperationResult>,
  createRestorePoint: (description: string) => ipcRenderer.invoke('backups:createRestorePoint', description) as Promise<OperationResult>,
  ensureInitialRestorePoint: () => ipcRenderer.invoke('backups:ensureInitialRestorePoint') as Promise<OperationResult>,
};

const debloat = {
  listApps: () => ipcRenderer.invoke('debloat:listApps') as Promise<OperationResult>,
  uninstallApps: (ids: string[]) => ipcRenderer.invoke('debloat:uninstallApps', ids) as Promise<OperationResult>,
};

const network = {
  pickExecutable: () => ipcRenderer.invoke('network:pickExecutable') as Promise<OperationResult>,
  listQosPolicies: () => ipcRenderer.invoke('network:listQosPolicies') as Promise<OperationResult>,
  createQosPolicy: (appPath: string) => ipcRenderer.invoke('network:createQosPolicy', appPath) as Promise<OperationResult>,
  removeQosPolicy: (fileName: string) => ipcRenderer.invoke('network:removeQosPolicy', fileName) as Promise<OperationResult>,
};

const updater = {
  check: () => ipcRenderer.invoke('updater:check') as Promise<OperationResult>,
  download: () => ipcRenderer.invoke('updater:download') as Promise<OperationResult>,
  install: () => ipcRenderer.invoke('updater:install') as Promise<OperationResult>,
  getStatus: () => ipcRenderer.invoke('updater:getStatus') as Promise<OperationResult<UpdateStatusPayload>>,
  onStatus: (cb: (status: UpdateStatusPayload) => void) => {
    const listener = (_e: unknown, status: UpdateStatusPayload) => cb(status);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
};

const auth = {
  login: () => ipcRenderer.invoke('auth:login') as Promise<OperationResult>,
  logout: () => ipcRenderer.invoke('auth:logout') as Promise<OperationResult>,
  getStatus: () => ipcRenderer.invoke('auth:getStatus') as Promise<OperationResult<AuthStatus>>,
  refresh: () => ipcRenderer.invoke('auth:refresh') as Promise<OperationResult<AuthStatus>>,
  onStatusChanged: (cb: (status: AuthStatus) => void) => {
    const listener = (_e: unknown, status: AuthStatus) => cb(status);
    ipcRenderer.on('auth:statusChanged', listener);
    return () => ipcRenderer.removeListener('auth:statusChanged', listener);
  },
};

const api = { window: windowControls, system, hardware, tweaks, backups, debloat, network, bios, gameMode, fixes, updater, auth };

contextBridge.exposeInMainWorld('frontier', api);

export type FrontierApi = typeof api;
