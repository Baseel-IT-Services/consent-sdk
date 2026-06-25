import { SdkConfig, ErrorCode } from '@baseel/types';
import { ConfigurationError } from './errors.js';

export function validateConfig(config: SdkConfig): Required<SdkConfig> {
  if (!config) {
    throw new ConfigurationError('Configuration object is required', ErrorCode.CONFIG_MISSING_APP_ID);
  }

  if (typeof config.appId !== 'string' || config.appId.trim() === '') {
    throw new ConfigurationError('Configuration option "appId" is required and must be a non-empty string', ErrorCode.CONFIG_MISSING_APP_ID);
  }

  const validEnvironments = ['development', 'production', 'staging'];
  if (config.environment && !validEnvironments.includes(config.environment)) {
    throw new ConfigurationError(
      `Configuration option "environment" must be one of: ${validEnvironments.join(', ')}`,
      ErrorCode.CONFIG_INVALID_ENV
    );
  }

  const validLogLevels = ['none', 'error', 'warn', 'info', 'debug'];
  if (config.logLevel && !validLogLevels.includes(config.logLevel)) {
    throw new ConfigurationError(
      `Configuration option "logLevel" must be one of: ${validLogLevels.join(', ')}`,
      ErrorCode.CONFIG_INVALID_LOG_LEVEL
    );
  }

  return {
    appId: config.appId,
    environment: config.environment || 'production',
    logLevel: config.logLevel || 'error',
    consent: {
      enabled: config.consent?.enabled !== false,
      defaultStatus: config.consent?.defaultStatus || 'denied',
    },
    customEndpoint: config.customEndpoint || '',
    autoInitialize: config.autoInitialize ?? true,
  };
}
