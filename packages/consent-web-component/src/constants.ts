export const ELEMENT_TAG = 'baseel-consent' as const;

export const ATTR = {
  PUBLIC_KEY: 'public-key',
  SESSION_TOKEN: 'session-token',
  SCREEN_ID: 'screen-id',
  API_BASE_URL: 'api-base-url',
  /** When set, consent can only be submitted after this email is verified by OTP. */
  EMAIL: 'email',
} as const;

export const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/** Digits in a consent verification OTP — matches the backend's verify-otp validation. */
export const EMAIL_OTP_LENGTH = 6;

export const OTP_RESEND_COOLDOWN_SECONDS = 30;
