import { useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import '@baseel-sdk/consent-web-component';
import { BASEEL_EVENTS } from '@baseel-sdk/consent-web-component';
import type { ConsentGrantedDetail, ConsentDeniedDetail } from '@baseel-sdk/consent-web-component';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'baseel-consent': {
        ref?: (el: HTMLElement | null) => void;
        'public-key'?: string;
        'session-token'?: string;
        'screen-id'?: string;
        'api-base-url'?: string;
        class?: string;
        style?: CSSProperties;
      };
    }
  }
}

export interface BaseelConsentProps {
  publicKey: string;
  screenId: string;
  sessionToken: string;
  apiBaseUrl?: string;
  onConsentGranted?: (detail: ConsentGrantedDetail) => void;
  onConsentDenied?: (detail: ConsentDeniedDetail) => void;
  onConsentError?: (message: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function BaseelConsent({
  publicKey,
  screenId,
  sessionToken,
  apiBaseUrl,
  onConsentGranted,
  onConsentDenied,
  onConsentError,
  className,
  style,
}: BaseelConsentProps) {
  // Refs hold the latest callbacks without triggering re-renders
  const grantedRef = useRef(onConsentGranted);
  const deniedRef = useRef(onConsentDenied);
  const errorRef = useRef(onConsentError);
  grantedRef.current = onConsentGranted;
  deniedRef.current = onConsentDenied;
  errorRef.current = onConsentError;

  // Stable ref callback — attaches DOM event listeners once when the element mounts
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener(BASEEL_EVENTS.CONSENT_GRANTED, (e) => {
      grantedRef.current?.((e as CustomEvent<ConsentGrantedDetail>).detail);
    });
    el.addEventListener(BASEEL_EVENTS.CONSENT_DENIED, (e) => {
      deniedRef.current?.((e as CustomEvent<ConsentDeniedDetail>).detail);
    });
    el.addEventListener(BASEEL_EVENTS.CONSENT_ERROR, (e) => {
      errorRef.current?.((e as CustomEvent<{ message: string }>).detail.message);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <baseel-consent
      ref={ref}
      public-key={publicKey}
      screen-id={screenId}
      session-token={sessionToken}
      {...(apiBaseUrl ? { 'api-base-url': apiBaseUrl } : {})}
      {...(className ? { class: className } : {})}
      style={style}
    />
  );
}
