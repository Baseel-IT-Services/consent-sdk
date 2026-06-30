import { ATTR, ELEMENT_TAG, DEFAULT_API_BASE_URL } from '../constants.js';
import { StateManager } from './StateManager.js';
import { Renderer } from './Renderer.js';
import { getConsentScreen, submitConsent } from '../api/consent.js';
import type { SubmitPurpose } from '../api/consent.js';
import { dispatchConsentGranted, dispatchConsentDenied, dispatchConsentError } from '../events/events.js';

export interface ComponentConfig {
  publicKey: string;
  sessionToken: string;
  screenId: string;
  apiBaseUrl: string;
}

export class BaseelConsent extends HTMLElement {
  static get observedAttributes(): string[] {
    return [ATTR.PUBLIC_KEY, ATTR.SESSION_TOKEN, ATTR.SCREEN_ID, ATTR.API_BASE_URL];
  }

  private stateManager = new StateManager();
  private renderer: Renderer | null = null;
  private fetchGen = 0;

  private handleAccept = (e: Event): void => {
    const state = this.stateManager.getState();
    const config = this.getConfig();
    if (!config || !state.template) return;

    const purposes: SubmitPurpose[] = (e as CustomEvent).detail?.purposes ?? [];

    this.stateManager.set('submitting');

    submitConsent(state.template.uuid, config.sessionToken, purposes, config.apiBaseUrl)
      .then(result => {
        this.stateManager.set('success');
        dispatchConsentGranted(this, {
          consentId: result.consentId,
          purposes: purposes.filter(p => p.accepted).map(p => p.uuid),
          timestamp: Date.now(),
        });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Submission failed.';
        this.stateManager.set('error', { error: message });
        dispatchConsentError(this, message);
      });
  };

  private handleDeny = (): void => {
    dispatchConsentDenied(this, { timestamp: Date.now() });
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.renderer = new Renderer(this.shadowRoot!);
    this.stateManager.onChange(data => this.renderer!.render(data));
    this.renderer.render(this.stateManager.getState());
    this.shadowRoot!.addEventListener('baseel:internal:accept', this.handleAccept);
    this.shadowRoot!.addEventListener('baseel:internal:deny', this.handleDeny);
    this.bootstrap();
  }

  disconnectedCallback(): void {
    this.shadowRoot!.removeEventListener('baseel:internal:accept', this.handleAccept);
    this.shadowRoot!.removeEventListener('baseel:internal:deny', this.handleDeny);
    this.renderer = null;
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (this.renderer && oldValue !== newValue) {
      this.bootstrap();
    }
  }

  getConfig(): ComponentConfig | null {
    const publicKey = this.getAttribute(ATTR.PUBLIC_KEY);
    const sessionToken = this.getAttribute(ATTR.SESSION_TOKEN);
    const screenId = this.getAttribute(ATTR.SCREEN_ID);
    const apiBaseUrl = this.getAttribute(ATTR.API_BASE_URL) ?? DEFAULT_API_BASE_URL;

    if (!publicKey || !sessionToken || !screenId) {
      const missing = [
        !publicKey && ATTR.PUBLIC_KEY,
        !sessionToken && ATTR.SESSION_TOKEN,
        !screenId && ATTR.SCREEN_ID,
      ].filter(Boolean).join(', ');

      console.error(`[${ELEMENT_TAG}] Missing required attributes: ${missing}`);
      return null;
    }

    return { publicKey, sessionToken, screenId, apiBaseUrl };
  }

  private bootstrap(): void {
    const config = this.getConfig();

    if (!config) {
      this.stateManager.set('error', {
        error: 'Missing required attributes: public-key, session-token, screen-id.',
      });
      return;
    }

    this.stateManager.set('loading');
    const gen = ++this.fetchGen;

    getConsentScreen(config.screenId, config.publicKey, config.sessionToken, config.apiBaseUrl)
      .then(template => {
        if (gen !== this.fetchGen) return;
        this.stateManager.set('ready', { template });
      })
      .catch((err: unknown) => {
        if (gen !== this.fetchGen) return;
        const message = err instanceof Error ? err.message : 'Failed to load consent screen.';
        this.stateManager.set('error', { error: message });
      });
  }
}
