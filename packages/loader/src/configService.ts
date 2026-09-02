import { BackendSdkConfig } from '@baseel-sdk/types';
import { ApiClient } from './apiClient.js';
import { Logger } from './logger.js';
import { validateBackendConfig } from './backendConfigValidator.js';

export interface ConfigServiceOptions {
  environment?: 'development' | 'production' | 'staging';
  customEndpoint?: string;
  logger?: Logger;
}

const DEFAULT_ENDPOINTS: Record<string, string> = {
  development: 'https://api-dev.baseel.com',
  staging: 'https://api-staging.baseel.com',
  production: 'https://api.baseel.com',
};

export class ConfigService {
  private apiClient: ApiClient;
  private environment: 'development' | 'production' | 'staging';
  private customEndpoint: string;
  private logger?: Logger;

  constructor(apiClient: ApiClient, options: ConfigServiceOptions = {}) {
    this.apiClient = apiClient;
    this.environment = options.environment || 'production';
    this.customEndpoint = options.customEndpoint || '';
    this.logger = options.logger;
  }

  public getBaseUrl(): string {
    if (this.customEndpoint) {
      return this.customEndpoint.replace(/\/+$/, '');
    }
    return DEFAULT_ENDPOINTS[this.environment] || DEFAULT_ENDPOINTS.production;
  }

  public async fetchConfig(appId: string): Promise<BackendSdkConfig> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/configs/${encodeURIComponent(appId)}`;

    this.logger?.debug(`ConfigService: Fetching config from ${url} (environment: ${this.environment})`);

    const responseData = await this.apiClient.get<any>(url);

    this.logger?.debug('ConfigService: Received response from backend, validating schema...');

    const validatedConfig = validateBackendConfig(responseData);

    this.logger?.info(`ConfigService: Successfully fetched and validated configuration for appId ${appId}`);

    return validatedConfig;
  }
}
