/**
 * ------------------------------------------------------------------
 * Logger
 * ------------------------------------------------------------------
 * Logger đơn giản với màu sắc và context.
 * In log với level, caller location, và metadata.
 *
 * Main exports:
 * - Logger        : Class logger với các level (info, error, warn, debug)
 * - createLogger() : Factory function tạo logger với context
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import path from 'path';

// ─── Constants ──────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const LEVEL_COLOR: Record<string, string> = {
  ERROR: COLORS.red,
  WARN: COLORS.yellow,
  INFO: COLORS.green,
  DEBUG: COLORS.blue,
};

// ─── Helpers ────────────────────────────────────────────────────────────

function getCallerFile(): string {
  const obj: any = {};
  Error.captureStackTrace(obj);
  const line = (obj.stack as string).split('\n')[4] || '';
  const match = line.match(/\((.+):(\d+):\d+\)/) || line.match(/at\s+(.+):(\d+):\d+/);
  if (match) {
    return `${path.relative(process.cwd(), match[1])}:${match[2]}`;
  }
  return 'unknown';
}

function formatMeta(args: any[]): string {
  if (!args.length) return '';
  return ' ' + args.map((a) => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'object') return JSON.stringify(a);
    return String(a);
  }).join(' ');
}

// ─── Class ──────────────────────────────────────────────────────────────

export class Logger {
  constructor(private context: string) {}

  private log(level: string, message: string, ...args: any[]) {
    const color = LEVEL_COLOR[level] || '';
    const caller = getCallerFile();
    const meta = formatMeta(args);
    process.stdout.write(
      `${color}${COLORS.bold}[${level}]${COLORS.reset} ${COLORS.gray}[${caller}]${COLORS.reset} ${message}${meta}\n`
    );
  }

  info(message: string, ...args: any[]) { this.log('INFO', message, ...args); }
  error(message: string, ...args: any[]) { this.log('ERROR', message, ...args); }
  warn(message: string, ...args: any[]) { this.log('WARN', message, ...args); }
  debug(message: string, ...args: any[]) { this.log('DEBUG', message, ...args); }
}

export const createLogger = (context: string) => new Logger(context);