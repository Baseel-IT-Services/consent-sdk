import { SdkConfig, BackendSdkConfig } from './config.js';
import { ConsentStatus } from './consent.js';
import { SdkEventMap } from './event.js';

export interface BaseelSdkInstance {
  version: string;
  config: Readonly<Required<SdkConfig>>;
  backendConfig: Readonly<BackendSdkConfig>;
  isInitialized: boolean;
  getConsentStatus(): ConsentStatus;
  setConsentStatus(status: ConsentStatus): Promise<void>;
  on<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void;
  off<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void;
  emit<K extends keyof SdkEventMap>(event: K, data: SdkEventMap[K]): void;
}
