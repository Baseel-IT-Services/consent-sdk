import { ATTR, ELEMENT_TAG, DEFAULT_API_BASE_URL } from '../constants.js';
import { StateManager } from './StateManager.js';
import { Renderer } from './Renderer.js';

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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.renderer = new Renderer(this.shadowRoot!);
    this.stateManager.onChange(data => this.renderer!.render(data));
    this.renderer.render(this.stateManager.getState());
    this.bootstrap();
  }

  disconnectedCallback(): void {
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
    // API call wired in Milestone 3
  }
}
