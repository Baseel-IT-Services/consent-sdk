export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export interface ConsentConfig {
  enabled: boolean;
  defaultStatus?: 'granted' | 'denied';
}

export interface SdkConfig {
  appId: string;
  environment?: 'development' | 'production' | 'staging';
  logLevel?: LogLevel;
  consent?: ConsentConfig;
  customEndpoint?: string;
  autoInitialize?: boolean;
}

export interface BackendConsentCategory {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  defaultStatus: 'granted' | 'denied';
}

export interface BackendConsentConfig {
  enabled: boolean;
  categories: BackendConsentCategory[];
}

export interface BackendSdkConfig {
  appId: string;
  appName: string;
  consent: BackendConsentConfig;
  version: string;
  banner?: {
    title?: string;
    description?: string;
    primaryButtonText?: string;
    secondaryButtonText?: string;
  };
}
