import { normalizeChoices, resolveConfig } from './config.js';
import type { ResolvedConfig } from './config.js';
import { ConsentEmitter } from './emitter.js';
import { ConsentStorage, createBrowserId } from './storage.js';
import type { StoredConsent } from './storage.js';
import { CookieConsentUI } from './ui.js';
import { isRetryable, saveCookieConsent } from './api.js';
import { deleteCookiesByPrefix } from './cookies.js';
import { CookieConsentError } from './types.js';
import type {
  CookieConsentConfig,
  CookieConsentEvent,
  CookieConsentEventMap,
  CookieConsentRecord,
  CookieConsentState,
} from './types.js';

const INSTANCE_KEY = Symbol.for('baseel.cookieConsent');

/** Fired on `window` when an instance starts or is destroyed, e.g. for `useCookieConsent()`. */
export const COOKIE_CONSENT_EVENTS = {
  INIT: 'baseel:cookie-consent-init',
  DESTROY: 'baseel:cookie-consent-destroy',
} as const;
const MAX_SYNC_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 60_000;

type GlobalWithInstance = typeof globalThis & { [INSTANCE_KEY]?: CookieConsent };

/**
 * Cookie banner and category-level consent. Captures and reports the visitor's choice;
 * the website decides what to load from it — this class never loads, blocks or deletes
 * anything on its own.
 *
 * ```ts
 * const cmp = CookieConsent.init({ siteKey: 'pk_live_xxx', categories: [...] });
 * cmp.on('consentReady', apply);
 * cmp.on('consentChanged', apply);
 * ```
 */
export class CookieConsent {
  /** Helpers the merchant can call, e.g. to clear first-party cookies on withdrawal. */
  readonly utils = { deleteCookiesByPrefix };

  private record: StoredConsent | null;
  private userToken: string | null;
  private readonly emitter: ConsentEmitter;
  private readonly ui: CookieConsentUI;
  private syncInFlight: Promise<boolean> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private destroyed = false;

  /**
   * Starts the SDK. Call once at the app root; a second call returns the same instance.
   * Throws `CookieConsentError` (`INVALID_CONFIG`) for a bad config, and
   * (`NOT_IN_BROWSER`) during server-side rendering.
   */
  static init(config: CookieConsentConfig): CookieConsent {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new CookieConsentError('NOT_IN_BROWSER', '[CookieConsent] init() must be called in the browser, not during server-side rendering.');
    }
    const existing = CookieConsent.getInstance();
    if (existing) {
      console.warn('[CookieConsent] init() was already called; returning the existing instance.');
      return existing;
    }
    const instance = new CookieConsent(resolveConfig(config));
    (globalThis as GlobalWithInstance)[INSTANCE_KEY] = instance;
    instance.start();
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENTS.INIT, { detail: instance }));
    return instance;
  }

  /** The running instance, or null before `init()`. */
  static getInstance(): CookieConsent | null {
    return (globalThis as GlobalWithInstance)[INSTANCE_KEY] ?? null;
  }

  private constructor(
    private readonly config: ResolvedConfig,
    private readonly storage = new ConsentStorage(config.siteKey)
  ) {
    this.userToken = config.userToken;
    this.record = this.storage.read();
    this.emitter = new ConsentEmitter((event, err) =>
      console.error(`[CookieConsent] Error in "${event}" listener:`, err)
    );
    this.ui = new CookieConsentUI(config, {
      acceptAll: () => this.acceptAll(),
      rejectOptional: () => this.rejectOptional(),
      save: choices => this.save(choices),
      openPreferences: () => this.openPreferences(),
      closePreferences: () => this.ui.closePreferences(this.record !== null),
    });
  }

  private start(): void {
    this.log(`Storage: ${this.storage.kind}.`);
    window.addEventListener('storage', this.onStorage);
    this.ui.mount();

    if (!this.record) {
      this.log('No stored consent in this browser; showing the banner.');
      this.ui.setHasConsent(false);
      return;
    }

    if (this.record.configVersion !== this.config.configVersion) {
      // Re-prompting on category changes is pending sign-off; new categories count as not allowed.
      this.log(`Stored consent was given for config ${this.record.configVersion}; current is ${this.config.configVersion}.`);
    }
    this.log('Stored consent found; firing consentReady.', this.toState(this.record));
    this.ui.setHasConsent(true);
    this.emitter.emit('consentReady', this.toState(this.record));

    if (this.record.pendingSync && this.userToken) {
      this.log('Previous choice has not reached the backend yet; retrying.');
      void this.sync();
    }
  }

  // ── Reading consent ──

  /** The current choice, or null when the user has not chosen yet. */
  getConsent(): CookieConsentState | null {
    return this.record ? this.toState(this.record) : null;
  }

  /** Whether scripts and cookies of this category may be used. Required categories are always allowed. */
  isAllowed(categoryId: string): boolean {
    const category = this.config.categories.find(c => c.id === categoryId);
    if (!category) {
      console.warn(`[CookieConsent] isAllowed(): unknown category "${categoryId}".`);
      return false;
    }
    if (category.required) return true;
    return this.record?.categories[categoryId] === true;
  }

  /** Whether the user has made any choice in this browser. */
  hasConsented(): boolean {
    return this.record !== null;
  }

  /** The full browser record for the registration handoff, or null when the user has not chosen yet. */
  getConsentRecord(): CookieConsentRecord | null {
    if (!this.record) return null;
    return {
      siteKey: this.record.siteKey,
      browserId: this.record.browserId,
      configVersion: this.record.configVersion,
      ...this.toState(this.record),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
  }

  // ── Changing consent ──

  /** Opens the preferences modal, e.g. from a "Cookie settings" footer link. */
  openPreferences(): void {
    if (this.destroyed) return;
    this.ui.openPreferences(normalizeChoices(this.config.categories, this.record?.categories));
  }

  /** Turns every category on. */
  acceptAll(): CookieConsentState {
    const all: Record<string, boolean> = {};
    for (const c of this.config.categories) all[c.id] = true;
    return this.save(all);
  }

  /** Keeps only the required categories on. */
  rejectOptional(): CookieConsentState {
    return this.save({});
  }

  /**
   * Sets choices from the merchant's own UI. Categories left out keep their current value;
   * required categories stay on and unknown ids are ignored.
   */
  setConsent(categories: Record<string, boolean>): CookieConsentState {
    if (!categories || typeof categories !== 'object') {
      throw new CookieConsentError('INVALID_CONFIG', '[CookieConsent] setConsent() expects an object of category id to true/false.');
    }
    const known = new Set(this.config.categories.map(c => c.id));
    for (const id of Object.keys(categories)) {
      if (!known.has(id)) console.warn(`[CookieConsent] setConsent(): ignoring unknown category "${id}".`);
    }
    return this.save({ ...normalizeChoices(this.config.categories, this.record?.categories), ...categories });
  }

  // ── Registered users ──

  /**
   * Links this browser's consent to a registered Consent Manager user; later changes are
   * also saved in the backend. Pass null on logout to stop syncing. Resolves to true when the
   * current choice reached the backend (or there is none yet); failures are also sent to `error` listeners.
   */
  async identify(userToken: string | null): Promise<boolean> {
    if (this.destroyed) return false;
    this.userToken = typeof userToken === 'string' && userToken.trim() !== '' ? userToken.trim() : null;
    this.clearRetry();
    this.retryCount = 0;
    if (!this.userToken) {
      this.log('identify(null): backend sync stopped.');
      return true;
    }
    if (!this.record) {
      this.log('identify(): no choice yet; it will be saved to the backend once made.');
      return true;
    }
    this.record = this.storage.write({ ...this.record, registered: true, pendingSync: true });
    return this.sync();
  }

  // ── Events ──

  /** `consentReady` replays the current state to listeners added after it fired. */
  on<K extends CookieConsentEvent>(event: K, handler: (data: CookieConsentEventMap[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends CookieConsentEvent>(event: K, handler: (data: CookieConsentEventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  /** Removes the UI and listeners. A later `init()` starts a fresh instance. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRetry();
    window.removeEventListener('storage', this.onStorage);
    this.ui.destroy();
    this.emitter.clear();
    const g = globalThis as GlobalWithInstance;
    if (g[INSTANCE_KEY] === this) delete g[INSTANCE_KEY];
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENTS.DESTROY));
  }

  // ── Internals ──

  private save(choices: Record<string, boolean>): CookieConsentState {
    const categories = normalizeChoices(this.config.categories, choices);
    if (this.destroyed) return { categories, updatedAt: new Date().toISOString() };

    this.record = this.storage.write({
      browserId: this.record?.browserId ?? createBrowserId(),
      configVersion: this.config.configVersion,
      categories,
      updatedAt: new Date().toISOString(),
      registered: this.userToken !== null || this.record?.registered === true,
      pendingSync: this.userToken !== null,
    });
    const state = this.toState(this.record);
    this.log('Choice saved; firing consentChanged.', state);

    if (this.ui.isPreferencesOpen) this.ui.closePreferences(true);
    else this.ui.setHasConsent(true);

    this.emitter.updateReadyState(state);
    this.emitter.emit('consentChanged', state);

    if (this.userToken) {
      this.clearRetry();
      this.retryCount = 0;
      void this.sync();
    }
    return state;
  }

  /** Sends the stored choice to the backend; one request at a time, latest choice wins. */
  private sync(): Promise<boolean> {
    if (this.syncInFlight) {
      return this.syncInFlight.then(() => this.sync());
    }
    const record = this.record;
    const token = this.userToken;
    if (!record || !record.pendingSync || !token || this.destroyed) return Promise.resolve(true);

    this.syncInFlight = (async () => {
      try {
        await saveCookieConsent(
          { url: this.config.endpoints.saveConsent, siteKey: this.config.siteKey, userToken: token },
          {
            browserId: record.browserId,
            categories: record.categories,
            configVersion: record.configVersion,
            consentedAt: record.updatedAt,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          }
        );
        if (this.record && this.record.updatedAt === record.updatedAt && this.record.browserId === record.browserId) {
          this.record = this.storage.write({ ...this.record, pendingSync: false });
        }
        this.retryCount = 0;
        this.log('Choice saved to Consent Manager.');
        return true;
      } catch (err) {
        const error = err instanceof CookieConsentError
          ? err
          : new CookieConsentError('NETWORK_ERROR', 'Unable to reach Consent Manager.');
        console.error(`[CookieConsent] Backend sync failed: ${error.message}`);
        this.emitter.emit('error', error);
        if (isRetryable(error)) this.scheduleRetry();
        return false;
      } finally {
        this.syncInFlight = null;
      }
    })();
    return this.syncInFlight;
  }

  private scheduleRetry(): void {
    if (this.destroyed || this.retryTimer || this.retryCount >= MAX_SYNC_RETRIES) {
      if (this.retryCount >= MAX_SYNC_RETRIES) this.log('Giving up for now; will retry on the next page load.');
      return;
    }
    const delay = Math.min(2000 * 2 ** this.retryCount, MAX_RETRY_DELAY_MS);
    this.retryCount++;
    this.log(`Retrying backend sync in ${delay} ms (attempt ${this.retryCount}/${MAX_SYNC_RETRIES}).`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** A choice saved in another tab reaches this one through the storage event. */
  private onStorage = (e: StorageEvent): void => {
    if (e.key !== null && e.key !== this.storage.key) return;
    const next = this.storage.read();
    if (next?.updatedAt === this.record?.updatedAt && next?.browserId === this.record?.browserId) return;
    this.record = next;
    if (this.ui.isPreferencesOpen) this.ui.closePreferences(next !== null);
    else this.ui.setHasConsent(next !== null);
    if (next) {
      const state = this.toState(next);
      this.log('Choice changed in another tab; firing consentChanged.', state);
      this.emitter.updateReadyState(state);
      this.emitter.emit('consentChanged', state);
    }
  };

  private toState(record: StoredConsent): CookieConsentState {
    return {
      categories: normalizeChoices(this.config.categories, record.categories),
      updatedAt: record.updatedAt,
    };
  }

  private log(message: string, ...data: unknown[]): void {
    if (this.config.debug) console.info(`[CookieConsent] ${message}`, ...data);
  }
}
