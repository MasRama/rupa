import pino, { type Logger } from 'pino';
import type { LogLevel } from '@/core/config';

export type { Logger };

export interface LoggerOptions {
  level: LogLevel;
  /** Human-readable output for development; JSON lines otherwise. */
  pretty: boolean;
}

export function createLogger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
}
