import { LogLevel } from '@baseel-sdk/types';

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'error') {
    this.level = level;
  }

  private get priority(): Record<LogLevel, number> {
    return { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
  }

  private shouldLog(msgLevel: LogLevel): boolean {
    return this.priority[msgLevel] >= this.priority[this.level];
  }

  public debug(msg: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[Baseel SDK] [DEBUG] ${msg}`, ...args);
    }
  }

  public info(msg: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[Baseel SDK] [INFO] ${msg}`, ...args);
    }
  }

  public warn(msg: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[Baseel SDK] [WARN] ${msg}`, ...args);
    }
  }

  public error(msg: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[Baseel SDK] [ERROR] ${msg}`, ...args);
    }
  }
}
