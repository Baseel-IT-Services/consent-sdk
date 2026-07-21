/**
 * Compatibility test: exercises the full public surface of
 * @baseel/consent-web-component as a standalone TypeScript consumer would.
 */
import {
  BaseelConsent,
  BASEEL_EVENTS,
  dispatchConsentGranted,
  dispatchConsentDenied,
  dispatchConsentError,
  ELEMENT_TAG,
  ATTR,
  DEFAULT_API_BASE_URL,
} from '@baseel/consent-web-component';
import type {
  ComponentConfig,
  ComponentState,
  StateData,
  ConsentGrantedDetail,
  ConsentDeniedDetail,
} from '@baseel/consent-web-component';

// --- Class: BaseelConsent -------------------------------------------------
// Confirm it's a constructible custom element class.
declare const someElement: BaseelConsent;
const configFromElement: ComponentConfig | null = someElement.getConfig();
void configFromElement;

if (typeof customElements !== 'undefined') {
  customElements.define(ELEMENT_TAG, BaseelConsent);
}

// --- Constants -------------------------------------------------------------
const tag: 'baseel-consent' = ELEMENT_TAG;
const publicKeyAttr: 'public-key' = ATTR.PUBLIC_KEY;
const sessionTokenAttr: 'session-token' = ATTR.SESSION_TOKEN;
const screenIdAttr: 'screen-id' = ATTR.SCREEN_ID;
const apiBaseUrlAttr: 'api-base-url' = ATTR.API_BASE_URL;
const defaultApiBaseUrl: string = DEFAULT_API_BASE_URL;
void [tag, publicKeyAttr, sessionTokenAttr, screenIdAttr, apiBaseUrlAttr, defaultApiBaseUrl];

// --- ComponentConfig ---------------------------------------------------
const config: ComponentConfig = {
  publicKey: 'pub_test_123',
  sessionToken: 'session_abc',
  screenId: 'screen_1',
  apiBaseUrl: DEFAULT_API_BASE_URL,
};
void config;

// --- StateData across every ComponentState union member -----------------
const loadingState: StateData = {
  state: 'loading',
};

const readyState: StateData = {
  state: 'ready',
  // `template` is optional and typed as WidgetTemplate (from @baseel/types);
  // intentionally omitted here since we don't have a WidgetTemplate value handy
  // and the field is optional.
};

const submittingState: StateData = {
  state: 'submitting',
};

const successState: StateData = {
  state: 'success',
};

const errorState: StateData = {
  state: 'error',
  error: 'Something went wrong',
};

const allStates: StateData[] = [loadingState, readyState, submittingState, errorState, successState];
void allStates;

// Confirm ComponentState is the exact literal union (exhaustiveness check).
function describeState(state: ComponentState): string {
  switch (state) {
    case 'loading':
      return 'loading';
    case 'ready':
      return 'ready';
    case 'submitting':
      return 'submitting';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    default: {
      // If ComponentState ever gains a new member, this line fails to compile,
      // proving the union above is exhaustive and in sync with the real type.
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}
void describeState;

// --- BASEEL_EVENTS: confirm literal typing (not widened to `string`) -------
const grantedEventName: 'baseel:consent-granted' = BASEEL_EVENTS.CONSENT_GRANTED;
const deniedEventName: 'baseel:consent-denied' = BASEEL_EVENTS.CONSENT_DENIED;
const errorEventName: 'baseel:consent-error' = BASEEL_EVENTS.CONSENT_ERROR;
void [grantedEventName, deniedEventName, errorEventName];

// --- dispatch* functions against a real HTMLElement -------------------------
const el = document.createElement('div');

const grantedDetail: ConsentGrantedDetail = {
  consentId: 'consent-1',
  purposes: ['analytics', 'marketing'],
  timestamp: Date.now(),
};
dispatchConsentGranted(el, grantedDetail);

// consentId is optional — omitting it should still type-check.
dispatchConsentGranted(el, {
  purposes: ['analytics'],
  timestamp: Date.now(),
});

const deniedDetail: ConsentDeniedDetail = {
  timestamp: Date.now(),
};
dispatchConsentDenied(el, deniedDetail);

dispatchConsentError(el, 'network failure while submitting consent');

// --- INTENTIONALLY WRONG USAGES (kept commented out) ------------------------
// Uncommenting any of the lines below should cause `tsc` to fail, proving the
// types are load-bearing rather than `any`-typed. Verified manually during
// this compat pass; see REPORT.md for the exact error messages produced.
//
// 1) Missing required `purposes: string[]` field on ConsentGrantedDetail:
// dispatchConsentGranted(el, { timestamp: Date.now() });
//
// 2) Wrong type for `timestamp` (string instead of number):
// dispatchConsentDenied(el, { timestamp: 'not-a-number' });
//
// 3) Invalid ComponentState literal:
// const badState: StateData = { state: 'pending' };
//
// 4) Invalid BASEEL_EVENTS member access typed as the wrong literal:
// const wrongEventName: 'baseel:consent-granted' = BASEEL_EVENTS.CONSENT_DENIED;
