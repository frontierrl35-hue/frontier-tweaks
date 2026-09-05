import fs from 'node:fs';
import path from 'node:path';

// Lazily resolve the logs directory to avoid importing Electron's `app`
// before it is ready when this module is first loaded.
let logFile: string | null = null;

function resolveLogFile(): string | null {
  if (logFile) return logFile;
  try {
    // Deferred require to avoid a circular import with paths.ts during
    // very early startup.
    const { getLogsDir } = require('./paths') as typeof import('./paths');
    logFile = path.join(getLogsDir(), `frontier-tweaks-${new Date().toISOString().slice(0, 10)}.log`);
    return logFile;
  } catch {
    return null;
  }
}

const REDACT_KEYS = ['password', 'token', 'secret', 'apikey', 'key'];

function redact(obj: unknown): unknown {
  if (obj && typeof obj === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      clone[k] = REDACT_KEYS.some((r) => k.toLowerCase().includes(r)) ? '[redacted]' : v;
    }
    return clone;
  }
  return obj;
}

function write(level: string, event: string, meta?: unknown) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(meta ? { meta: redact(meta) } : {}),
  });
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](line);
  const file = resolveLogFile();
  if (file) {
    try {
      fs.appendFileSync(file, line + '\n');
    } catch {
      /* best-effort logging only */
    }
  }
}

export const logger = {
  info: (event: string, meta?: unknown) => write('info', event, meta),
  warn: (event: string, meta?: unknown) => write('warn', event, meta),
  error: (event: string, meta?: unknown) => write('error', event, meta),
};
