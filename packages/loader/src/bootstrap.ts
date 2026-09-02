import { SdkConfig, BaseelSdkInstance, ErrorCode } from '@baseel-sdk/types';
import { validateConfig } from './configValidator.js';
import { BaseelSdk } from './sdkInstance.js';
import { InitializationError } from './errors.js';
import { Logger } from './logger.js';
import { ApiClient } from './apiClient.js';
import { ConfigService } from './configService.js';

declare global {
  interface Window {
    __BASEEL_SDK__?: BaseelSdkInstance;
    BaseelSdk?: BaseelSdkInstance;
  }
}

export async function bootstrap(config: SdkConfig): Promise<BaseelSdkInstance> {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    if (window.__BASEEL_SDK__) {
      const existing = window.__BASEEL_SDK__;
      if (existing.config.appId !== config.appId) {
        throw new InitializationError(
          `Baseel SDK is already initialized with appId "${existing.config.appId}". Cannot re-initialize with appId "${config.appId}".`,
          ErrorCode.SDK_ALREADY_INITIALIZED
        );
      }
      console.warn('[Baseel SDK] Already initialized. Returning the existing instance.');
      return existing;
    }
  }

  const validatedConfig = validateConfig(config);
  const logger = new Logger(validatedConfig.logLevel);

  logger.info('Initializing SDK and fetching configuration from backend...');

  const apiClient = new ApiClient({
    logger,
  });

  const configService = new ConfigService(apiClient, {
    environment: validatedConfig.environment,
    customEndpoint: validatedConfig.customEndpoint,
    logger,
  });

  try {
    const backendConfig = await configService.fetchConfig(validatedConfig.appId);
    const instance = new BaseelSdk(validatedConfig, backendConfig);

    if (isBrowser) {
      window.__BASEEL_SDK__ = instance;
      window.BaseelSdk = instance;
    }

    instance.isInitialized = true;
    instance.emit('initialized', instance);

    logger.info('SDK initialization completed successfully.');
    return instance;
  } catch (error: any) {
    logger.error('Failed to initialize Baseel SDK:', error);
    throw error;
  }
}

