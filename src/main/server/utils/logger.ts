import winston from 'winston';
import path from 'path';
import { app } from 'electron';

const isDev = !app.isPackaged;
const isSilent = process.env.SILENT_SERVER === 'true';

// Determine log file path
const logFilePath = isDev
  ? path.join(process.cwd(), 'server.log') // Project root in dev
  : path.join(app.getPath('userData'), 'server.log'); // User data in prod

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    // Always write to file
    new winston.transports.File({ filename: logFilePath }),
  ],
});

// Add console transport unless silenced
if (!isSilent) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

export default logger;
