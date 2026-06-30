export const BASEEL_EVENTS = {
  CONSENT_GRANTED: 'baseel:consent-granted',
  CONSENT_DENIED: 'baseel:consent-denied',
  CONSENT_ERROR: 'baseel:consent-error',
} as const;

export interface ConsentGrantedDetail {
  consentId?: string;
  purposes: string[];
  timestamp: number;
}

export interface ConsentDeniedDetail {
  timestamp: number;
}

export function dispatchConsentGranted(element: HTMLElement, detail: ConsentGrantedDetail): void {
  element.dispatchEvent(
    new CustomEvent(BASEEL_EVENTS.CONSENT_GRANTED, { detail, bubbles: true, composed: true })
  );
}

export function dispatchConsentDenied(element: HTMLElement, detail: ConsentDeniedDetail): void {
  element.dispatchEvent(
    new CustomEvent(BASEEL_EVENTS.CONSENT_DENIED, { detail, bubbles: true, composed: true })
  );
}

export function dispatchConsentError(element: HTMLElement, message: string): void {
  element.dispatchEvent(
    new CustomEvent(BASEEL_EVENTS.CONSENT_ERROR, { detail: { message }, bubbles: true, composed: true })
  );
}
