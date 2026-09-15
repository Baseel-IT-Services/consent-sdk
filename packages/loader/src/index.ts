import { SdkConfig, BaseelSdkInstance } from '@baseel/types';
import { bootstrap } from './bootstrap.js';

export function loadSdk(config: SdkConfig): Promise<BaseelSdkInstance> {
  return bootstrap(config);
}

export { BaseelError, ConfigurationError, InitializationError, ConsentError, ApiError } from './errors.js';

