export const ELEMENT_TAG = 'baseel-consent' as const;

export const ATTR = {
  PUBLIC_KEY: 'public-key',
  SESSION_TOKEN: 'session-token',
  SCREEN_ID: 'screen-id',
  API_BASE_URL: 'api-base-url',
} as const;

export const DEFAULT_API_BASE_URL = 'http://localhost:8080';
