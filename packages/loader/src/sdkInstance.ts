import { BaseelSdkInstance, SdkConfig, BackendSdkConfig, ConsentStatus, SdkEventMap, ConsentChangePayload } from '@baseel-sdk/types';
import { EventEmitter } from './eventEmitter.js';
import { ConsentError } from './errors.js';
import { Logger } from './logger.js';

export class BaseelSdk implements BaseelSdkInstance {
  public readonly version = '0.0.1';
  public readonly config: Readonly<Required<SdkConfig>>;
  public readonly backendConfig: Readonly<BackendSdkConfig>;
  public isInitialized = false;

  private consentStatus: ConsentStatus;
  private emitter = new EventEmitter();
  private logger: Logger;

  constructor(config: Required<SdkConfig>, backendConfig: BackendSdkConfig) {
    this.config = Object.freeze(config);
    this.backendConfig = Object.freeze(backendConfig);
    this.consentStatus = this.config.consent.defaultStatus || 'denied';
    this.logger = new Logger(this.config.logLevel);
  }

  public getConsentStatus(): ConsentStatus {
    this.log('debug', `getConsentStatus called: ${this.consentStatus}`);
    return this.consentStatus;
  }

  public async setConsentStatus(status: ConsentStatus): Promise<void> {
    if (status !== 'granted' && status !== 'denied') {
      const err = new ConsentError(`Invalid consent status: ${status}`);
      this.emit('error', {
        code: err.code,
        message: err.message,
      });
      throw err;
    }

    if (this.consentStatus === status) {
      this.log('debug', `setConsentStatus: Status already ${status}. Skipping update.`);
      return;
    }

    const oldStatus = this.consentStatus;
    this.consentStatus = status;
    this.log('info', `Consent status updated from ${oldStatus} to ${status}`);

    const payload: ConsentChangePayload = {
      status,
      timestamp: Date.now(),
      source: 'user',
    };

    this.emit('consent_changed', payload);
  }

  public on<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void {
    this.emitter.on(event, handler);
  }

  public off<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  public emit<K extends keyof SdkEventMap>(event: K, data: SdkEventMap[K]): void {
    this.emitter.emit(event, data);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (level === 'debug') this.logger.debug(message, ...args);
    else if (level === 'info') this.logger.info(message, ...args);
    else if (level === 'warn') this.logger.warn(message, ...args);
    else if (level === 'error') this.logger.error(message, ...args);
  }
}

