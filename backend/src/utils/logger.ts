import winston from 'winston';
import path from 'path';

const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(customColors);

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return String(message);
        }),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  private getCallerInfo(): string {
    const obj: any = {};
    Error.captureStackTrace(obj);
    const stack = obj.stack.split('\n');
    // Stack index 4 usually points to the caller of info/debug/etc.
    // 0: Error
    // 1: getCallerInfo
    // 2: Logger.formatMessage
    // 3: Logger.info/warn/etc
    // 4: Caller
    const callerLine = stack[4] || '';

    const match =
      callerLine.match(/\((.+):(\d+):(\d+)\)/) ||
      callerLine.match(/at\s+(.+):(\d+):(\d+)/);
    if (match) {
      const filePath = match[1];
      const relativePath = path.relative(process.cwd(), filePath);
      return `${relativePath}:${match[2]}`;
    }
    return 'unknown';
  }

  private formatMessage(level: string, message: string, ...args: any[]) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const caller = this.getCallerInfo();
    const colorizer = winston.format.colorize();
    const coloredLevel = colorizer.colorize(
      level,
      level.toUpperCase().padEnd(5),
    );

    const metaStr =
      args.length > 0
        ? args
            .map((a) => {
              if (a instanceof Error) {
                return JSON.stringify(
                  { message: a.message, stack: a.stack },
                  null,
                  2,
                );
              }
              return typeof a === 'object' ? JSON.stringify(a) : a;
            })
            .join(' ')
        : '';

    const metaOutput = metaStr ? ` [${metaStr}]` : '';

    // [12:01:45] [DEBUG] [<relative_path>:<line_number>] [message] [metadata]
    console.log(
      `[${timestamp}] [${coloredLevel}] [${caller}] [${message}]${metaOutput}`,
    );
  }

  info(message: string, ...args: any[]) {
    this.formatMessage('info', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.formatMessage('error', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.formatMessage('warn', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.formatMessage('debug', message, ...args);
  }
}

export const createLogger = (context: string) => new Logger(context);
