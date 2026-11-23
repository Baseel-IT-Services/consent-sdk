// Cookie banner + category-level consent. Kept free of `register.js` so importing it
// never defines <baseel-consent>: `@baseel/consent-sdk/cookie-consent` ships only this.
export { CookieConsent, COOKIE_CONSENT_EVENTS } from './CookieConsent.js';
export { CookieConsentError } from './types.js';
export type {
  CookieCategory,
  CookieBannerContent,
  CookieBannerLayout,
  CookieBannerPosition,
  CookieBannerTheme,
  CookieConsentEndpoints,
  CookieConsentConfig,
  CookieConsentState,
  CookieConsentRecord,
  CookieConsentErrorCode,
  CookieConsentEventMap,
  CookieConsentEvent,
} from './types.js';
export { deleteCookiesByPrefix } from './cookies.js';
