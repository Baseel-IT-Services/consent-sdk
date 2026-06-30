import type { StateData } from './StateManager.js';
import type { WidgetPurposeItem } from '@baseel/types';

const STYLES = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --baseel-primary: #0066ff;
    --baseel-text: #1a1a1a;
    --baseel-muted: #6b7280;
    --baseel-border: #e5e7eb;
    --baseel-bg: #ffffff;
    --baseel-radius: 12px;
    --baseel-danger: #dc2626;
    --baseel-success: #16a34a;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .widget {
    background: var(--baseel-bg);
    border: 1px solid var(--baseel-border);
    border-radius: var(--baseel-radius);
    padding: 24px;
    max-width: 480px;
    width: 100%;
  }

  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    gap: 14px;
  }
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--baseel-border);
    border-top-color: var(--baseel-primary);
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .center-state p { color: var(--baseel-muted); font-size: 14px; }

  .error-icon { font-size: 32px; }
  .error-msg { color: var(--baseel-danger); font-size: 14px; text-align: center; }

  .success-icon { font-size: 40px; }
  .success-msg { font-size: 15px; font-weight: 500; color: var(--baseel-success); }

  .logo { max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 16px; }
  .title { font-size: 18px; font-weight: 600; color: var(--baseel-text); margin-bottom: 8px; }
  .description { font-size: 14px; color: var(--baseel-muted); margin-bottom: 20px; line-height: 1.5; }

  .purposes { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
  .purpose-item { display: flex; align-items: flex-start; gap: 12px; }
  .purpose-item input[type="checkbox"] { margin-top: 2px; width: 16px; height: 16px; cursor: pointer; accent-color: var(--baseel-primary); flex-shrink: 0; }
  .purpose-item input[type="checkbox"]:disabled { cursor: not-allowed; opacity: 0.6; }
  .purpose-text { display: flex; flex-direction: column; gap: 2px; }
  .purpose-name { font-size: 14px; font-weight: 500; color: var(--baseel-text); }
  .purpose-desc { font-size: 12px; color: var(--baseel-muted); line-height: 1.4; }
  .purpose-required { font-size: 11px; color: var(--baseel-primary); font-weight: 500; }

  .actions { display: flex; gap: 10px; justify-content: flex-end; }
  .btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--baseel-primary); color: #fff; }
  .btn-secondary { background: transparent; color: var(--baseel-text); border: 1px solid var(--baseel-border); }

  .footer-text { font-size: 11px; color: var(--baseel-muted); margin-top: 16px; text-align: center; line-height: 1.4; }
`;

export class Renderer {
  private root: ShadowRoot;

  constructor(shadowRoot: ShadowRoot) {
    this.root = shadowRoot;
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.root.appendChild(style);
  }

  render(data: StateData): void {
    const existing = this.root.querySelector('.widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.className = 'widget';

    switch (data.state) {
      case 'loading':
        widget.innerHTML = this.loading('Loading consent screen...');
        break;
      case 'submitting':
        widget.innerHTML = this.loading('Submitting your preferences...');
        break;
      case 'success':
        widget.innerHTML = this.success();
        break;
      case 'error':
        widget.innerHTML = this.error(data.error ?? 'Something went wrong.');
        break;
      case 'ready':
        if (data.template) {
          const { logoUrl, title, description, purposes, footer } = data.template;
          widget.innerHTML = this.ready(logoUrl, title, description, purposes, footer);
          this.attachFormHandlers(widget);
        } else {
          widget.innerHTML = this.error('Template data is missing.');
        }
        break;
    }

    this.root.appendChild(widget);
  }

  private loading(message: string): string {
    return `<div class="center-state"><div class="spinner"></div><p>${message}</p></div>`;
  }

  private error(message: string): string {
    return `<div class="center-state"><span class="error-icon">⚠</span><p class="error-msg">${message}</p></div>`;
  }

  private success(): string {
    return `<div class="center-state"><span class="success-icon">✓</span><p class="success-msg">Your preferences have been saved.</p></div>`;
  }

  private ready(
    logoUrl: string | undefined,
    title: string,
    description: string | undefined,
    purposes: WidgetPurposeItem[],
    footer: string | undefined
  ): string {
    const logo = logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : '';
    const desc = description ? `<p class="description">${description}</p>` : '';
    const footerHtml = footer ? `<p class="footer-text">${footer}</p>` : '';
    const purposesHtml = purposes.map(p => `
      <div class="purpose-item">
        <input type="checkbox" name="purpose" value="${p.uuid}"
          ${p.accepted || p.required ? 'checked' : ''}
          ${p.required ? 'disabled' : ''}
          data-required="${p.required}" />
        <div class="purpose-text">
          <span class="purpose-name">${p.name}</span>
          ${p.description ? `<span class="purpose-desc">${p.description}</span>` : ''}
          ${p.required ? '<span class="purpose-required">Required</span>' : ''}
        </div>
      </div>`).join('');

    return `${logo}<h2 class="title">${title}</h2>${desc}
      <div class="purposes">${purposesHtml}</div>
      <div class="actions">
        <button class="btn btn-secondary" data-action="deny">Decline</button>
        <button class="btn btn-primary" data-action="accept">Accept</button>
      </div>${footerHtml}`;
  }

  private attachFormHandlers(widget: HTMLElement): void {
    widget.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
      const checkboxes = widget.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="purpose"]');
      const purposes = Array.from(checkboxes).map(cb => ({
        uuid: cb.value,
        accepted: cb.checked,
      }));
      widget.dispatchEvent(new CustomEvent('baseel:internal:accept', {
        detail: { purposes },
        bubbles: true,
        composed: true,
      }));
    });

    widget.querySelector('[data-action="deny"]')?.addEventListener('click', () => {
      widget.dispatchEvent(new CustomEvent('baseel:internal:deny', { bubbles: true, composed: true }));
    });
  }
}
