import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSdk, ConfigurationError, InitializationError, ConsentError, ApiError } from './index.js';
import { ErrorCode } from '@baseel/types';
import { Logger } from './logger.js';
import { ApiClient } from './apiClient.js';
import { ConfigService } from './configService.js';
import { validateBackendConfig } from './backendConfigValidator.js';

describe('Baseel SDK Loader', () => {
  const originalWindow = (globalThis as any).window;

  const mockBackendConfig = {
    appId: 'my-app',
    appName: 'Baseel Test App',
    consent: {
      enabled: true,
      categories: [
        { id: 'essential', name: 'Essential Cookies', required: true, defaultStatus: 'granted' },
        { id: 'analytics', name: 'Analytics Cookies', required: false, defaultStatus: 'denied' }
      ]
    },
    version: '1.0.0'
  };

  beforeEach(() => {
    (globalThis as any).window = undefined;

    // Default global fetch mock for integration tests
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockBackendConfig,
      };
    }));
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Logger Utility', () => {
    it('should respect priority levels and only log higher or equal levels', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Logger set to 'warn' should only log 'warn' and 'error'
      const logger = new Logger('warn');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('[Baseel SDK] [WARN] test warn');
      expect(errorSpy).toHaveBeenCalledWith('[Baseel SDK] [ERROR] test error');
    });

    it('should suppress all logs when level is none', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const logger = new Logger('none');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('ApiClient (Generic HTTP)', () => {
    it('should fetch JSON data successfully', async () => {
      const client = new ApiClient();
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true })
      }));
      vi.stubGlobal('fetch', mockFetch);

      const res = await client.get('https://example.com/test');
      expect(res).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/test', expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' }
      }));
    });

    it('should throw ApiError with API_UNAUTHORIZED on 401/403 status code', async () => {
      const client = new ApiClient();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers()
      })));

      await expect(client.get('https://example.com/test')).rejects.toThrow(ApiError);
      try {
        await client.get('https://example.com/test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.API_UNAUTHORIZED);
        expect(err.status).toBe(401);
      }
    });

    it('should throw ApiError with API_CLIENT_ERROR on non-2xx status code', async () => {
      const client = new ApiClient();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers()
      })));

      await expect(client.get('https://example.com/test')).rejects.toThrow(ApiError);
      try {
        await client.get('https://example.com/test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.API_CLIENT_ERROR);
        expect(err.status).toBe(500);
      }
    });

    it('should throw ApiError with INVALID_BACKEND_RESPONSE if contentType is not application/json', async () => {
      const client = new ApiClient();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: async () => ({})
      })));

      await expect(client.get('https://example.com/test')).rejects.toThrow(ApiError);
      try {
        await client.get('https://example.com/test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.INVALID_BACKEND_RESPONSE);
      }
    });

    it('should throw ApiError with API_TIMEOUT on request timeout', async () => {
      const client = new ApiClient({ timeoutMs: 1 });
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, init) => {
        // Wait a bit to let controller abort
        await new Promise((resolve) => setTimeout(resolve, 5));
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        throw err;
      }));

      await expect(client.get('https://example.com/test')).rejects.toThrow(ApiError);
      try {
        await client.get('https://example.com/test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.API_TIMEOUT);
      }
    });

    it('should throw ApiError with API_NETWORK_ERROR on generic fetch network error', async () => {
      const client = new ApiClient();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        throw new Error('Failed to fetch');
      }));

      await expect(client.get('https://example.com/test')).rejects.toThrow(ApiError);
      try {
        await client.get('https://example.com/test');
      } catch (err: any) {
        expect(err.code).toBe(ErrorCode.API_NETWORK_ERROR);
      }
    });
  });

  describe('BackendConfigValidator', () => {
    it('should validate and return a frozen config when valid', () => {
      const valid = {
        appId: 'test-app',
        appName: 'Test Application',
        consent: {
          enabled: true,
          categories: [
            { id: 'c1', name: 'Cat 1', required: true, defaultStatus: 'granted' }
          ]
        },
        version: '1.2.3',
        banner: {
          title: 'We use cookies',
          description: 'Desc',
          primaryButtonText: 'Allow',
          secondaryButtonText: 'Deny'
        }
      };

      const res = validateBackendConfig(valid);
      expect(res.appId).toBe('test-app');
      expect(res.appName).toBe('Test Application');
      expect(res.consent.enabled).toBe(true);
      expect(res.consent.categories[0].id).toBe('c1');
      expect(res.banner?.title).toBe('We use cookies');
    });

    it('should throw ApiError with INVALID_BACKEND_RESPONSE when missing critical fields', () => {
      expect(() => validateBackendConfig(null)).toThrow(ApiError);
      expect(() => validateBackendConfig({})).toThrow(ApiError);
      expect(() => validateBackendConfig({ appId: 't' })).toThrow(ApiError);
      expect(() => validateBackendConfig({ appId: 't', appName: 'n' })).toThrow(ApiError);
      expect(() => validateBackendConfig({ appId: 't', appName: 'n', consent: {} })).toThrow(ApiError);
      expect(() => validateBackendConfig({ appId: 't', appName: 'n', consent: { enabled: true, categories: 'not-an-array' } })).toThrow(ApiError);
    });

    it('should throw ApiError with INVALID_BACKEND_RESPONSE when category is invalid', () => {
      const invalidCat = {
        appId: 't',
        appName: 'n',
        consent: {
          enabled: true,
          categories: [
            { id: '', name: 'Cat 1', required: true, defaultStatus: 'granted' } // empty id
          ]
        }
      };
      expect(() => validateBackendConfig(invalidCat)).toThrow(ApiError);

      const invalidStatus = {
        appId: 't',
        appName: 'n',
        consent: {
          enabled: true,
          categories: [
            { id: 'c1', name: 'Cat 1', required: true, defaultStatus: 'maybe' } // invalid status
          ]
        }
      };
      expect(() => validateBackendConfig(invalidStatus)).toThrow(ApiError);
    });
  });

  describe('ConfigService', () => {
    it('should resolve URLs based on environment when customEndpoint is absent', () => {
      const client = new ApiClient();
      const serviceDev = new ConfigService(client, { environment: 'development' });
      const serviceStaging = new ConfigService(client, { environment: 'staging' });
      const serviceProd = new ConfigService(client, { environment: 'production' });

      expect(serviceDev.getBaseUrl()).toBe('https://api-dev.baseel.com');
      expect(serviceStaging.getBaseUrl()).toBe('https://api-staging.baseel.com');
      expect(serviceProd.getBaseUrl()).toBe('https://api.baseel.com');
    });

    it('should use customEndpoint and strip trailing slashes when provided', () => {
      const client = new ApiClient();
      const service = new ConfigService(client, {
        environment: 'development',
        customEndpoint: 'https://custom-url.com///'
      });

      expect(service.getBaseUrl()).toBe('https://custom-url.com');
    });

    it('should query correct path and run validator', async () => {
      const client = new ApiClient();
      const getSpy = vi.spyOn(client, 'get').mockResolvedValue(mockBackendConfig);
      const service = new ConfigService(client, { environment: 'production' });

      const res = await service.fetchConfig('test-app-id');
      expect(getSpy).toHaveBeenCalledWith('https://api.baseel.com/v1/configs/test-app-id');
      expect(res.appId).toBe('my-app');
    });
  });

  describe('Configuration Validation (Client-side)', () => {
    it('should throw ConfigurationError if config is null or undefined', async () => {
      await expect(loadSdk(null as any)).rejects.toThrow(ConfigurationError);
      await expect(loadSdk(undefined as any)).rejects.toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError if appId is missing or empty', async () => {
      await expect(loadSdk({ appId: '' })).rejects.toThrow(ConfigurationError);
      await expect(loadSdk({ appId: '   ' })).rejects.toThrow(ConfigurationError);
      await expect(loadSdk({} as any)).rejects.toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError if environment is invalid', async () => {
      await expect(loadSdk({ appId: 'test-app', environment: 'invalid-env' as any })).rejects.toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError if logLevel is invalid', async () => {
      await expect(loadSdk({ appId: 'test-app', logLevel: 'invalid-log' as any })).rejects.toThrow(ConfigurationError);
    });
  });

  describe('Successful Initialization & Defaults', () => {
    it('should initialize and resolve to SdkInstance with default values and backendConfig', async () => {
      const sdk = await loadSdk({ appId: 'my-app' });

      expect(sdk.isInitialized).toBe(true);
      expect(sdk.version).toBe('0.0.1');
      expect(sdk.config.appId).toBe('my-app');
      expect(sdk.config.environment).toBe('production');
      expect(sdk.config.logLevel).toBe('error');
      expect(sdk.config.consent.enabled).toBe(true);
      expect(sdk.config.consent.defaultStatus).toBe('denied');
      expect(sdk.getConsentStatus()).toBe('denied');
      expect(sdk.backendConfig).toBeDefined();
      expect(sdk.backendConfig.appName).toBe('Baseel Test App');
      expect(sdk.backendConfig.consent.categories.length).toBe(2);
    });

    it('should respect custom configurations', async () => {
      const sdk = await loadSdk({
        appId: 'my-custom-app',
        environment: 'development',
        logLevel: 'debug',
        consent: {
          enabled: false,
          defaultStatus: 'granted',
        },
        customEndpoint: 'https://custom.baseel.com',
      });

      expect(sdk.config.appId).toBe('my-custom-app');
      expect(sdk.config.environment).toBe('development');
      expect(sdk.config.logLevel).toBe('debug');
      expect(sdk.config.consent.enabled).toBe(false);
      expect(sdk.config.consent.defaultStatus).toBe('granted');
      expect(sdk.config.customEndpoint).toBe('https://custom.baseel.com');
      expect(sdk.getConsentStatus()).toBe('granted');
    });
  });

  describe('Browser Global Bindings (Singleton Pattern)', () => {
    beforeEach(() => {
      (globalThis as any).window = {};
    });

    it('should bind instance to window object in browser environment', async () => {
      const sdk = await loadSdk({ appId: 'browser-app' });
      const win = (globalThis as any).window;

      expect(win.__BASEEL_SDK__).toBe(sdk);
      expect(win.BaseelSdk).toBe(sdk);
    });

    it('should return existing instance if initialized again with same appId', async () => {
      const sdk1 = await loadSdk({ appId: 'browser-app' });
      
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const sdk2 = await loadSdk({ appId: 'browser-app' });

      expect(sdk2).toBe(sdk1);
      expect(warnSpy).toHaveBeenCalled();
      
      warnSpy.mockRestore();
    });

    it('should throw InitializationError if initialized again with different appId', async () => {
      await loadSdk({ appId: 'browser-app-1' });
      await expect(loadSdk({ appId: 'browser-app-2' })).rejects.toThrow(InitializationError);
    });
  });

  describe('Event Emission', () => {
    it('should trigger consent_changed event upon update', async () => {
      const sdk = await loadSdk({ appId: 'event-app' });
      const consentSpy = vi.fn();
      sdk.on('consent_changed', consentSpy);

      await sdk.setConsentStatus('granted');
      expect(consentSpy).toHaveBeenCalledTimes(1);
      expect(consentSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'granted',
        source: 'user',
      }));
      expect(sdk.getConsentStatus()).toBe('granted');
    });

    it('should not emit consent_changed if status is unchanged', async () => {
      const sdk = await loadSdk({ appId: 'event-app' });
      const consentSpy = vi.fn();
      sdk.on('consent_changed', consentSpy);

      await sdk.setConsentStatus('denied');
      expect(consentSpy).not.toHaveBeenCalled();
    });

    it('should throw ConsentError and emit error event on invalid status', async () => {
      const sdk = await loadSdk({ appId: 'event-app' });
      const errorSpy = vi.fn();
      sdk.on('error', errorSpy);

      await expect(sdk.setConsentStatus('invalid-status' as any)).rejects.toThrow(ConsentError);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        code: ErrorCode.CONSENT_INVALID_STATE,
      }));
    });
  });

  describe('Bootstrap Config Fetch Failure Handling', () => {
    it('should reject initialization and throw when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        throw new Error('Network Disconnected');
      }));

      await expect(loadSdk({ appId: 'fetch-fail-app' })).rejects.toThrow(ApiError);
    });
  });
});
