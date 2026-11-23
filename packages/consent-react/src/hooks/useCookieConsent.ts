import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CookieConsent, COOKIE_CONSENT_EVENTS, CookieConsentError } from '@baseel/consent-web-component';
import type { CookieConsentConfig, CookieConsentState } from '@baseel/consent-web-component';

export interface UseCookieConsentResult {
  /** The running instance, or null before `init()` (and during server-side rendering). */
  instance: CookieConsent | null;
  /** True once an instance is running in this browser. */
  ready: boolean;
  /** The current choice, or null until the user chooses. */
  consent: CookieConsentState | null;
  /** Last `init()` or backend sync error. */
  error: CookieConsentError | null;
  /** Required categories are always allowed; everything is false before `init()`. */
  isAllowed(categoryId: string): boolean;
  openPreferences(): void;
  acceptAll(): CookieConsentState | null;
  rejectOptional(): CookieConsentState | null;
  setConsent(categories: Record<string, boolean>): CookieConsentState | null;
  identify(userToken: string | null): Promise<boolean>;
}

/**
 * React binding for `CookieConsent`. Pass the config once, at the app root, to start the SDK;
 * call it without arguments anywhere else to read the same instance. Re-renders when the
 * choice changes. The instance is not destroyed on unmount, since it belongs to the page.
 *
 * ```tsx
 * const { consent, isAllowed, openPreferences } = useCookieConsent();
 * ```
 */
export function useCookieConsent(config?: CookieConsentConfig): UseCookieConsentResult {
  const [instance, setInstance] = useState<CookieConsent | null>(null);
  const [consent, setConsentState] = useState<CookieConsentState | null>(null);
  const [error, setError] = useState<CookieConsentError | null>(null);

  // Read in the effect only, so a config object literal doesn't re-run it on every render.
  const configRef = useRef(config);
  configRef.current = config;
  const shouldInit = config !== undefined;

  useEffect(() => {
    if (shouldInit && !CookieConsent.getInstance()) {
      try {
        CookieConsent.init(configRef.current!);
      } catch (err) {
        console.error(err);
        setError(err instanceof CookieConsentError ? err : new CookieConsentError('INVALID_CONFIG', String(err)));
      }
    }
    // An instance started later (e.g. by a parent's effect) is picked up through the init event.
    const sync = () => setInstance(CookieConsent.getInstance());
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENTS.INIT, sync);
    window.addEventListener(COOKIE_CONSENT_EVENTS.DESTROY, sync);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENTS.INIT, sync);
      window.removeEventListener(COOKIE_CONSENT_EVENTS.DESTROY, sync);
    };
  }, [shouldInit]);

  useEffect(() => {
    setConsentState(instance?.getConsent() ?? null);
    if (!instance) return;
    const onChange = (state: CookieConsentState) => setConsentState(state);
    const onError = (err: CookieConsentError) => setError(err);
    instance.on('consentReady', onChange);
    instance.on('consentChanged', onChange);
    instance.on('error', onError);
    return () => {
      instance.off('consentReady', onChange);
      instance.off('consentChanged', onChange);
      instance.off('error', onError);
    };
  }, [instance]);

  // `consent` is a dependency so components re-check permissions after a change.
  const isAllowed = useCallback(
    (categoryId: string) => (instance ? instance.isAllowed(categoryId) : false),
    [instance, consent] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return useMemo(
    () => ({
      instance,
      ready: instance !== null,
      consent,
      error,
      isAllowed,
      openPreferences: () => instance?.openPreferences(),
      acceptAll: () => instance?.acceptAll() ?? null,
      rejectOptional: () => instance?.rejectOptional() ?? null,
      setConsent: (categories: Record<string, boolean>) => instance?.setConsent(categories) ?? null,
      identify: (userToken: string | null) => (instance ? instance.identify(userToken) : Promise.resolve(false)),
    }),
    [instance, consent, error, isAllowed]
  );
}
