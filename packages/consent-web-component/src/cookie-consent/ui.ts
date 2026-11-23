import type { ResolvedConfig } from './config.js';
import { COOKIE_CONSENT_STYLES } from './styles.js';

export const COOKIE_CONSENT_HOST_TAG = 'baseel-cookie-consent';

export interface UiActions {
  acceptAll(): void;
  rejectOptional(): void;
  save(choices: Record<string, boolean>): void;
  /** Customise or the floating button was clicked. */
  openPreferences(): void;
  /** The modal was dismissed without saving (close button, Esc, backdrop). */
  closePreferences(): void;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled])';
const COOKIE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
  '<path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3.5 3.5 3 3 0 0 0 2.5 2.5z"/>' +
  '<circle cx="8.5" cy="10.5" r="1" fill="currentColor"/><circle cx="12" cy="15.5" r="1" fill="currentColor"/>' +
  '<circle cx="15.5" cy="12.5" r="1" fill="currentColor"/></svg>';

let uid = 0;

type Attrs = Record<string, string | boolean | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string | null> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) {
    if (child !== null) node.append(child); // strings become text nodes, never HTML
  }
  return node;
}

/** Picks dark or light text for buttons filled with the merchant's primary colour. */
export function textColorOn(color: string): string {
  const hex = color.trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(hex) ? hex.replace(/./g, ch => ch + ch) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#FFFFFF';
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Compare contrast against white (1.05 / (L + 0.05)) and near-black (#111827, L ≈ 0.012).
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.062 ? '#FFFFFF' : '#111827';
}

/** Deepest focused element, looking through shadow roots. */
function activeElement(): HTMLElement | null {
  let active = document.activeElement as HTMLElement | null;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as HTMLElement;
  return active;
}

/** Banner, preferences modal and floating button, rendered in a Shadow DOM. */
export class CookieConsentUI {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private banner: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private fab: HTMLButtonElement | null = null;
  private returnFocus: HTMLElement | null = null;
  private waitingForBody: (() => void) | null = null;

  private bannerVisible = false;
  private fabVisible = false;
  private modalChoices: Record<string, boolean> | null = null;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly actions: UiActions
  ) {}

  /** Mounts once the body exists, so a script in <head> works and the banner renders after page content. */
  mount(): void {
    if (this.host || this.waitingForBody) return;
    if (document.body) {
      this.build();
      return;
    }
    this.waitingForBody = () => {
      this.waitingForBody = null;
      this.build();
    };
    document.addEventListener('DOMContentLoaded', this.waitingForBody, { once: true });
  }

  /** Shows the banner when there is no choice, the floating button once there is one. */
  setHasConsent(hasConsent: boolean): void {
    const focusInBanner = this.bannerVisible && !!this.banner?.contains(this.root?.activeElement ?? null);
    this.bannerVisible = !hasConsent && !this.modalChoices;
    this.fabVisible = hasConsent && this.config.theme.showFloatingButton;
    this.apply();
    // Accept/Reject hides the focused button; keep keyboard users near the controls.
    if (focusInBanner && !this.bannerVisible && this.fabVisible && !this.modalChoices) this.fab?.focus();
  }

  /** Does nothing while the modal is already open, so unsaved toggles are kept. */
  openPreferences(current: Record<string, boolean>): void {
    if (this.modalChoices) return;
    this.returnFocus = activeElement();
    this.modalChoices = { ...current };
    this.bannerVisible = false;
    this.apply();
  }

  /** Closes without saving. */
  closePreferences(hasConsent: boolean): void {
    if (!this.modalChoices) return;
    this.modalChoices = null;
    this.setHasConsent(hasConsent);
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected && !target.closest?.('[hidden]')) {
      target.focus();
    } else if (this.bannerVisible) {
      this.banner?.querySelector<HTMLElement>('button')?.focus();
    } else if (this.fabVisible) {
      this.fab?.focus();
    }
  }

  get isPreferencesOpen(): boolean {
    return this.modalChoices !== null;
  }

  destroy(): void {
    if (this.waitingForBody) document.removeEventListener('DOMContentLoaded', this.waitingForBody);
    this.waitingForBody = null;
    this.host?.remove();
    this.host = this.root = this.banner = this.overlay = this.fab = null;
  }

  private build(): void {
    const host = document.createElement(COOKIE_CONSENT_HOST_TAG);
    const root = host.attachShadow({ mode: 'open' });
    this.applyStyles(root);
    this.applyTheme(host);

    const wrapper = el('div', { class: 'root', lang: this.config.language });
    this.banner = this.buildBanner();
    this.fab = this.buildFab();
    this.overlay = el('div', { class: 'overlay', hidden: true });
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.close();
    });
    this.overlay.addEventListener('keydown', e => this.onModalKeydown(e));
    wrapper.append(this.banner, this.overlay, this.fab);
    root.append(wrapper);

    this.host = host;
    this.root = root;
    document.body.append(host);
    this.apply();
  }

  private applyStyles(root: ShadowRoot): void {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(COOKIE_CONSENT_STYLES);
      root.adoptedStyleSheets = [sheet];
    } catch {
      root.append(el('style', {}, [COOKIE_CONSENT_STYLES]));
    }
  }

  private applyTheme(host: HTMLElement): void {
    const t = this.config.theme;
    const vars: Record<string, string> = {
      '--bcc-primary': t.primaryColor,
      '--bcc-on-primary': textColorOn(t.primaryColor),
      '--bcc-bg': t.backgroundColor,
      '--bcc-text': t.textColor,
      '--bcc-font': t.fontFamily,
      '--bcc-font-size': t.fontSize,
      '--bcc-radius': t.borderRadius,
    };
    for (const [name, value] of Object.entries(vars)) host.style.setProperty(name, value);
  }

  private apply(): void {
    if (!this.root) return;
    this.banner!.hidden = !this.bannerVisible;
    this.fab!.hidden = !this.fabVisible || this.modalChoices !== null;

    // The modal is built once per opening; later calls only toggle visibility, so focus
    // and the user's unsaved toggles survive.
    if (this.modalChoices && !this.overlay!.firstChild) {
      this.overlay!.append(this.buildModal(this.modalChoices));
      this.overlay!.hidden = false;
      this.overlay!.querySelector<HTMLElement>('.modal')?.focus();
    } else if (!this.modalChoices && this.overlay!.firstChild) {
      this.overlay!.hidden = true;
      this.overlay!.replaceChildren();
    }
  }

  private button(text: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const b = el('button', { type: 'button', class: primary ? 'btn btn-primary' : 'btn' }, [text]);
    b.addEventListener('click', onClick);
    return b;
  }

  private buildBanner(): HTMLElement {
    const { content, theme } = this.config;
    const id = ++uid;
    const titleId = `bcc-title-${id}`;
    const messageId = `bcc-message-${id}`;
    const position = theme.layout === 'bar' && theme.position.startsWith('bottom') ? 'bottom' : theme.position;

    const message = el('p', { class: 'message', id: messageId }, [content.message]);
    if (content.privacyPolicyUrl) {
      message.append(
        ' ',
        el('a', { class: 'link', href: content.privacyPolicyUrl, target: '_blank', rel: 'noopener noreferrer' }, [
          content.privacyPolicyText,
        ])
      );
    }

    return el(
      'div',
      {
        class: `banner ${theme.layout} ${position}`,
        role: 'dialog',
        'aria-modal': 'false',
        'aria-labelledby': titleId,
        'aria-describedby': messageId,
        hidden: true,
      },
      [
        el('div', { class: 'banner-text' }, [el('h2', { class: 'title', id: titleId }, [content.title]), message]),
        el('div', { class: 'actions' }, [
          this.button(content.customiseText, false, () => this.actions.openPreferences()),
          this.button(content.rejectText, false, () => this.actions.rejectOptional()),
          this.button(content.acceptAllText, true, () => this.actions.acceptAll()),
        ]),
      ]
    );
  }

  private buildModal(choices: Record<string, boolean>): HTMLElement {
    const { content, categories } = this.config;
    const id = ++uid;
    const titleId = `bcc-prefs-${id}`;

    const close = el('button', { type: 'button', class: 'close', 'aria-label': content.closeLabel }, ['×']);
    close.addEventListener('click', () => this.close());

    const rows = categories.map((c, i) => {
      const labelId = `bcc-cat-${id}-${i}`;
      const descId = c.description ? `bcc-cat-desc-${id}-${i}` : undefined;
      const input = el('input', {
        type: 'checkbox',
        role: 'switch',
        'aria-labelledby': labelId,
        'aria-describedby': descId,
        disabled: c.required,
      });
      input.checked = c.required || choices[c.id] === true;
      input.addEventListener('change', () => {
        if (this.modalChoices) this.modalChoices[c.id] = input.checked;
      });
      return el('div', { class: 'category' }, [
        el('div', {}, [
          el('div', { class: 'category-label', id: labelId }, [c.label]),
          c.description ? el('p', { class: 'category-desc', id: descId }, [c.description]) : null,
        ]),
        el('div', { class: 'category-control' }, [
          c.required ? el('span', { class: 'always' }, [content.alwaysActiveText]) : null,
          el('label', { class: 'switch' }, [input, el('span', { class: 'track', 'aria-hidden': 'true' })]),
        ]),
      ]);
    });

    return el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' }, [
      el('div', { class: 'modal-header' }, [el('h2', { class: 'title', id: titleId }, [content.preferencesTitle]), close]),
      el('div', { class: 'modal-body' }, rows),
      el('div', { class: 'modal-footer' }, [
        this.button(content.rejectText, false, () => this.actions.rejectOptional()),
        this.button(content.saveText, true, () => this.actions.save({ ...(this.modalChoices ?? {}) })),
      ]),
    ]);
  }

  private buildFab(): HTMLButtonElement {
    const { content, theme } = this.config;
    const fab = el('button', {
      type: 'button',
      class: theme.position === 'bottom-right' ? 'fab right' : 'fab',
      'aria-label': content.floatingButtonLabel,
      title: content.floatingButtonLabel,
      hidden: true,
    });
    fab.innerHTML = COOKIE_ICON; // static markup, no merchant or user input
    fab.addEventListener('click', () => this.actions.openPreferences());
    return fab;
  }

  private close(): void {
    this.actions.closePreferences();
  }

  private onModalKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'Tab' || !this.root) return;
    const items = Array.from(this.overlay!.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const current = this.root.activeElement;
    if (e.shiftKey && (current === first || current === this.overlay!.querySelector('.modal'))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
