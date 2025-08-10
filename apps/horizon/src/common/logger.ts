import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: any;
}

const DEFAULT_LOG_FILE = path.resolve(process.cwd(), 'queue.log');
const LOG_FILE = process.env.QUEUE_LOG_FILE || DEFAULT_LOG_FILE;
const ENABLE_CONSOLE = (process.env.QUEUE_LOG_CONSOLE ?? 'true') !== 'false';

function write(entry: LogEntry) {
  const line = JSON.stringify(entry) + '\n';
  try {
    fs.appendFile(LOG_FILE, line, () => {});
  } catch (_) {
    // ignore file write errors to avoid crashing
  }
  if (ENABLE_CONSOLE) {
    const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    // Print compact console line plus minimal context
    // eslint-disable-next-line no-console
    (console as any)[method](`[queue] ${entry.level} ${entry.msg}`, entry.ctx ?? '');
  }
}

export const queueLogger = {
  debug(msg: string, ctx?: any) {
    write({ ts: new Date().toISOString(), level: 'debug', msg, ctx });
  },
  info(msg: string, ctx?: any) {
    write({ ts: new Date().toISOString(), level: 'info', msg, ctx });
  },
  warn(msg: string, ctx?: any) {
    write({ ts: new Date().toISOString(), level: 'warn', msg, ctx });
  },
  error(msg: string, ctx?: any) {
    write({ ts: new Date().toISOString(), level: 'error', msg, ctx });
  },
  filePath: LOG_FILE
}; 

export const logRouter = (basePath: string, router: any) => {
  const stack = router?.stack || [];
  for (const layer of stack) {
    const route = layer?.route;
    if (!route) continue;
    const methods = Object.keys(route.methods).map(m => m.toUpperCase()).join(',');
    console.log(`${methods.padEnd(10)} ${basePath}${route.path}`);
  }
};