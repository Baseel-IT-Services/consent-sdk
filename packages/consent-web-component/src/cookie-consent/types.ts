/** A named group of cookies serving one purpose. The end user consents per category. */
export interface CookieCategory {
  id: string;
  label: string;
  /** Shown under the label in the preferences modal. */
  description?: string;
  /** Required categories are always on and cannot be switched off by the end user. */
  required: boolean;
}

export interface CookieBannerContent {
  title?: string;
  message?: string;
  acceptAllText?: string;
  rejectText?: string;
  customiseText?: string;
  preferencesTitle?: string;
  saveText?: string;
  alwaysActiveText?: string;
  privacyPolicyText?: string;
  privacyPolicyUrl?: string;
  floatingButtonLabel?: string;
  closeLabel?: string;
}

export type CookieBannerLayout = 'bar' | 'box';
export type CookieBannerPosition = 'bottom' | 'top' | 'bottom-left' | 'bottom-right';

export interface CookieBannerTheme {
  layout?: CookieBannerLayout;
  position?: CookieBannerPosition;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: string;
  borderRadius?: string;
  showFloatingButton?: boolean;
}

export interface CookieConsentEndpoints {
  /**
   * Where a registered user's choice is POSTed. A path is joined to `apiBaseUrl`;
   * a full http(s) URL is used as is. Default: `/api/v1/cookie-consents`.
   */
  saveConsent?: string;
}

export interface CookieConsentConfig {
  /** The site's publishable key (same key as the consent widget's `public-key`). */
  siteKey: string;
  categories: CookieCategory[];
  content?: CookieBannerContent;
  language?: string;
  theme?: CookieBannerTheme;
  /** Set for registered Consent Manager users; their choices are also saved in the backend. */
  userToken?: string | null;
  /** Consent Manager API base URL. Only used when a `userToken` is set. */
  apiBaseUrl?: string;
  /** Overrides for the backend paths. Only used when a `userToken` is set. */
  endpoints?: CookieConsentEndpoints;
  /** Logs every decision to the console, for integration testing. */
  debug?: boolean;
}

/** The current choice, as returned by `getConsent()` and passed to event listeners. */
export interface CookieConsentState {
  categories: Record<string, boolean>;
  /** ISO-8601 time the choice was made. */
  updatedAt: string;
}

/** The full browser record, used for the registration handoff. */
export interface CookieConsentRecord extends CookieConsentState {
  siteKey: string;
  browserId: string;
  configVersion: string;
  userAgent: string;
}

export type CookieConsentErrorCode =
  | 'NOT_IN_BROWSER'
  | 'INVALID_CONFIG'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export interface CookieConsentEventMap {
  consentReady: CookieConsentState;
  consentChanged: CookieConsentState;
  error: CookieConsentError;
}

export type CookieConsentEvent = keyof CookieConsentEventMap;

export class CookieConsentError extends Error {
  readonly code: CookieConsentErrorCode;
  readonly status?: number;

  constructor(code: CookieConsentErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'CookieConsentError';
    this.code = code;
    this.status = status;
  }
}
