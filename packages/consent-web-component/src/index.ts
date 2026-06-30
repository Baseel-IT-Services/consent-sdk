import './register.js';

export { BaseelConsent } from './component/index.js';
export type { ComponentConfig, ComponentState, StateData } from './component/index.js';
export { BASEEL_EVENTS, dispatchConsentGranted, dispatchConsentDenied, dispatchConsentError } from './events/index.js';
export type { ConsentGrantedDetail, ConsentDeniedDetail } from './events/index.js';
export { ELEMENT_TAG, ATTR, DEFAULT_API_BASE_URL } from './constants.js';
