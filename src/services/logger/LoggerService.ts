import winston from 'winston';
import path from 'path';

export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;

  private constructor() {
    this.logger = this.createLogger();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private createLogger(): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isProduction = process.env.NODE_ENV === 'production';

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (stack) {
          logMessage += `\n${stack}`;
        }
        return logMessage;
      })
    );

    // Console format with colors for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        let logMessage = `${timestamp} ${level}: ${message}`;
        if (stack) {
          logMessage += `\n${stack}`;
        }
        return logMessage;
      })
    );

    const transports: winston.transport[] = [];

    // Console transport (always enabled)
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: isProduction ? logFormat : consoleFormat,
      })
    );

    // File transports (only in production or when explicitly configured)
    if (isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
      // Ensure logs directory exists
      const fs = require('fs');
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Combined logs
      transports.push(
        new winston.transports.File({
          level: logLevel,
          filename: path.join(logsDir, 'combined.log'),
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );

      // Error logs
      transports.push(
        new winston.transports.File({
          level: 'error',
          filename: path.join(logsDir, 'error.log'),
          format: logFormat,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      transports,
      // Handle uncaught exceptions and unhandled rejections
      exceptionHandlers: isProduction ? [
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'exceptions.log') 
        })
      ] : undefined,
      rejectionHandlers: isProduction ? [
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'rejections.log') 
        })
      ] : undefined,
    });
  }

  // Core logging methods
  public error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.logger.error(message, { stack: error.stack });
    } else if (error) {
      this.logger.error(message, { error });
    } else {
      this.logger.error(message);
    }
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Specialized logging methods for bot events
  public logCommand(commandName: string, userId: string, guildId?: string): void {
    this.info(`Command executed: ${commandName}`, {
      category: 'command',
      command: commandName,
      userId,
      guildId,
    });
  }

  public logEvent(eventName: string, data?: any): void {
    this.info(`Event processed: ${eventName}`, {
      category: 'event',
      event: eventName,
      data,
    });
  }

  public logDatabase(operation: string, table?: string, recordId?: string): void {
    this.debug(`Database operation: ${operation}`, {
      category: 'database',
      operation,
      table,
      recordId,
    });
  }

  public logDiscordAPI(endpoint: string, method: string, statusCode?: number): void {
    this.debug(`Discord API call: ${method} ${endpoint}`, {
      category: 'discord-api',
      endpoint,
      method,
      statusCode,
    });
  }

  public logSecurity(action: string, userId?: string, details?: any): void {
    this.warn(`Security event: ${action}`, {
      category: 'security',
      action,
      userId,
      details,
    });
  }

  // System lifecycle logging
  public logStartup(message: string): void {
    this.info(`🚀 ${message}`, { category: 'startup' });
  }

  public logShutdown(message: string): void {
    this.info(`🛑 ${message}`, { category: 'shutdown' });
  }

  // Get the underlying Winston logger for advanced usage
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }

  // Clean shutdown
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.end(() => {
        resolve();
      });
    });
  }
}