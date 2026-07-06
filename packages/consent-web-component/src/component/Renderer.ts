import type { StateData } from './StateManager.js';
import type { WidgetTemplate, WidgetPurposeItem } from '@baseel/types';

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  bn: 'Bengali (বাংলা)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  or: 'Odia (ଓଡ଼ିଆ)',
  fr: 'French', de: 'German', es: 'Spanish',
  zh: 'Chinese', ar: 'Arabic', pt: 'Portuguese',
  ja: 'Japanese', ko: 'Korean', it: 'Italian',
  nl: 'Dutch', ru: 'Russian', tr: 'Turkish', pl: 'Polish',
};

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
    max-width: 520px;
    width: 100%;
    overflow: hidden;
    position: relative;
  }

  /* ── Center states (loading / error / success) ── */
  .center-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 180px; gap: 14px; padding: 24px;
  }
  .spinner {
    width: 36px; height: 36px; border: 3px solid var(--baseel-border);
    border-top-color: var(--baseel-primary); border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .center-state p { color: var(--baseel-muted); font-size: 14px; }
  .error-icon { font-size: 32px; }
  .error-msg { color: var(--baseel-danger); font-size: 14px; text-align: center; }
  .success-icon { font-size: 40px; }
  .success-msg { font-size: 15px; font-weight: 500; color: var(--baseel-success); }

  /* ── Widget header ── */
  .widget-header {
    display: flex; align-items: center; gap: 14px;
    padding: 20px 24px; border-bottom: 1px solid var(--baseel-border);
  }
  .header-logo {
    width: 48px; height: 48px; border-radius: 10px;
    object-fit: contain; flex-shrink: 0;
  }
  .header-logo-placeholder {
    width: 48px; height: 48px; border-radius: 10px;
    background: #f0f4ff; display: flex; align-items: center;
    justify-content: center; font-size: 22px; flex-shrink: 0;
  }
  .header-meta { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .header-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .header-title { font-size: 15px; font-weight: 700; color: var(--baseel-text); flex: 1; min-width: 0; }
  .status-badge {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
    background: #dcfce7; color: #15803d; white-space: nowrap; flex-shrink: 0;
  }
  .header-sub { display: flex; align-items: center; gap: 6px; }
  .org-name { font-size: 13px; color: var(--baseel-muted); }
  .version-badge {
    font-size: 11px; background: #dbeafe; color: #1d4ed8;
    padding: 1px 7px; border-radius: 20px; font-weight: 500;
  }

  /* ── Language selector ── */
  .lang-row {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 24px; border-bottom: 1px solid var(--baseel-border);
  }
  .lang-icon { font-size: 15px; color: var(--baseel-muted); }
  .lang-label { font-size: 13px; color: var(--baseel-muted); flex: 1; }
  .lang-select {
    font-size: 13px; padding: 5px 10px; border: 1px solid var(--baseel-border);
    border-radius: 8px; color: var(--baseel-text); background: #fff; cursor: pointer;
    outline: none;
  }
  .lang-select:focus { border-color: var(--baseel-primary); }

  /* ── Content area ── */
  .content-section { padding: 20px 24px; border-bottom: 1px solid var(--baseel-border); }
  .content-heading { font-size: 16px; font-weight: 700; color: var(--baseel-text); margin-bottom: 6px; }
  .content-body { font-size: 14px; color: var(--baseel-muted); line-height: 1.6; }

  /* ── Purposes section ── */
  .purposes-section { padding: 20px 24px; border-bottom: 1px solid var(--baseel-border); }
  .section-title {
    font-size: 11px; font-weight: 700; color: var(--baseel-muted);
    letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 14px;
  }
  .purposes { display: flex; flex-direction: column; gap: 10px; }
  .purpose-item {
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px; border: 1px solid var(--baseel-border); border-radius: 8px;
  }
  .purpose-header { display: flex; align-items: flex-start; gap: 10px; }
  .purpose-header input[type="checkbox"] {
    margin-top: 2px; width: 16px; height: 16px; cursor: pointer;
    accent-color: var(--baseel-primary); flex-shrink: 0;
  }
  .purpose-text { display: flex; flex-direction: column; gap: 2px; }
  .purpose-name { font-size: 14px; font-weight: 600; color: var(--baseel-text); }
  .purpose-desc { font-size: 12px; color: var(--baseel-muted); line-height: 1.4; }
  .piis-list { display: flex; flex-direction: column; gap: 8px; padding-left: 26px; margin-top: 4px; }
  .pii-item { display: flex; align-items: center; gap: 10px; }
  .pii-item input[type="checkbox"] {
    width: 15px; height: 15px; cursor: pointer;
    accent-color: var(--baseel-primary); flex-shrink: 0;
  }
  .pii-item input[type="checkbox"]:disabled { cursor: not-allowed; opacity: 0.6; }
  .pii-label { display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .pii-title { font-size: 13px; font-weight: 500; color: var(--baseel-text); }
  .pii-desc { font-size: 11px; color: var(--baseel-muted); }
  .badge { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
  .badge-required { background: #fee2e2; color: var(--baseel-danger); }
  .badge-optional { background: #e0f2fe; color: #0369a1; }
  .pii-badge-col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .pii-expires { font-size: 11px; color: var(--baseel-muted); white-space: nowrap; }

  /* ── Footer / actions ── */
  .footer-section { padding: 16px 24px; }
  .footer-text {
    font-size: 12px; color: var(--baseel-muted); line-height: 1.5; margin-bottom: 14px;
  }
  .privacy-link {
    color: var(--baseel-primary); text-decoration: underline;
    cursor: pointer; font-weight: 500; background: none; border: none;
    font-size: inherit; font-family: inherit; padding: 0;
  }
  .actions { display: flex; gap: 10px; justify-content: flex-end; }
  .btn {
    padding: 9px 20px; border-radius: 8px; font-size: 14px;
    font-weight: 500; cursor: pointer; border: none; transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: var(--baseel-primary); color: #fff; }
  .btn-secondary {
    background: transparent; color: var(--baseel-text);
    border: 1px solid var(--baseel-border);
  }

  /* ── Privacy Notice Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 16px;
  }
  .modal-overlay[hidden] { display: none; }
  .modal-box {
    background: #fff; border-radius: 12px; max-width: 480px; width: 100%;
    max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--baseel-border); flex-shrink: 0;
  }
  .modal-title { font-size: 15px; font-weight: 600; color: var(--baseel-text); }
  .modal-close {
    background: none; border: none; font-size: 22px; cursor: pointer;
    color: var(--baseel-muted); padding: 0; line-height: 1;
  }
  .modal-body {
    padding: 16px 20px; overflow-y: auto; flex: 1;
    font-size: 13px; color: var(--baseel-muted); line-height: 1.7;
  }
  .modal-footer {
    padding: 12px 20px; border-top: 1px solid var(--baseel-border);
    font-size: 11px; color: var(--baseel-muted); flex-shrink: 0;
  }
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
          widget.innerHTML = this.ready(data.template);
          this.attachFormHandlers(widget);
          this.attachLanguageHandler(widget, data.template);
          this.attachPrivacyHandler(widget);
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

  private ready(template: WidgetTemplate): string {
    const {
      logoUrl, title, status, version, legalEntityName,
      header, body, footer, purposes, translations,
      notice, privacyNotice,
    } = template;

    // ── Header ──
    const logoHtml = logoUrl
      ? `<img class="header-logo" src="${logoUrl}" alt="Logo" />`
      : `<div class="header-logo-placeholder">🏦</div>`;
    const statusHtml = status
      ? `<span class="status-badge">${status.toUpperCase()}</span>` : '';
    const versionHtml = version
      ? `<span class="version-badge">v${version}</span>` : '';
    const orgHtml = legalEntityName
      ? `<span class="org-name">${legalEntityName}</span>` : '';

    // ── Language selector — always visible ──
    const langs: { code: string; label: string }[] = [{ code: 'en', label: 'English' }];
    if (translations) {
      Object.keys(translations).forEach(code => {
        if (code !== 'en') langs.push({ code, label: LANG_NAMES[code] ?? code.toUpperCase() });
      });
    }
    const langSelectorHtml = `
      <div class="lang-row">
        <span class="lang-icon">🌐</span>
        <span class="lang-label">Language</span>
        <select class="lang-select" data-lang-select>
          ${langs.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}
        </select>
      </div>`;

    // ── Content ──
    const contentHtml = (header || body) ? `
      <div class="content-section">
        ${header ? `<h2 class="content-heading" data-field="header">${header}</h2>` : ''}
        ${body ? `<p class="content-body" data-field="body">${body}</p>` : ''}
      </div>` : '';

    // ── Purposes ──
    const purposesHtml = this.renderPurposes(purposes);

    // ── Footer — Privacy Notice link always shown ──
    const noticeObj = notice ?? privacyNotice;
    const privacyLinkHtml = ` <button class="privacy-link" data-privacy-toggle>${noticeObj?.title ?? 'Privacy Notice'}</button>`;
    const footerText = footer ?? 'i agree the term and condition';
    const footerHtml = `<p class="footer-text" data-field="footer">${footerText}${privacyLinkHtml}</p>`;

    // ── Privacy Notice Modal (only rendered when notice data exists) ──
    const modalHtml = noticeObj ? `
      <div class="modal-overlay" data-privacy-modal hidden>
        <div class="modal-box">
          <div class="modal-header">
            <span class="modal-title">${noticeObj.title}</span>
            <button class="modal-close" data-privacy-close>×</button>
          </div>
          <div class="modal-body">${noticeObj.content}</div>
          ${(noticeObj.effectiveFrom || noticeObj.effectiveTo) ? `
          <div class="modal-footer">
            ${noticeObj.effectiveFrom ? `From ${noticeObj.effectiveFrom}` : ''}
            ${noticeObj.effectiveTo ? ` · until ${noticeObj.effectiveTo}` : ''}
          </div>` : ''}
        </div>
      </div>` : '';

    return `
      <div class="widget-header">
        ${logoHtml}
        <div class="header-meta">
          <div class="header-top">
            <span class="header-title">${title}</span>
            ${statusHtml}
          </div>
          ${(orgHtml || versionHtml) ? `<div class="header-sub">${orgHtml}${versionHtml}</div>` : ''}
        </div>
      </div>
      ${langSelectorHtml}
      ${contentHtml}
      <div class="purposes-section">
        <h3 class="section-title">What data we collect &amp; why</h3>
        <div class="purposes">${purposesHtml}</div>
      </div>
      <div class="footer-section">
        ${footerHtml}
        <div class="actions">
          <button class="btn btn-primary" data-action="accept">Agree &amp; Save</button>
        </div>
      </div>
      ${modalHtml}
    `;
  }

  private renderPurposes(purposes: WidgetPurposeItem[]): string {
    return purposes.map(p => {
      const label = p.name ?? p.title ?? p.description ?? p.purposeCode ?? 'Purpose';
      const piisHtml = p.piis.map(pii => {
        const piiLabel = pii.name ?? pii.title ?? pii.piiCode ?? pii.description ?? '';
        return `
          <div class="pii-item">
            <input type="checkbox" name="pii" value="${pii.piiUuid}"
              ${pii.required ? 'checked disabled' : ''}
              data-purpose="${p.purposeUuid}" data-required="${pii.required}" />
            <div class="pii-label">
              <span class="pii-title">${piiLabel}</span>
              ${pii.description ? `<span class="pii-desc">${pii.description}</span>` : ''}
            </div>
            <div class="pii-badge-col">
              <span class="badge ${pii.required ? 'badge-required' : 'badge-optional'}">${pii.required ? 'Required' : 'Optional'}</span>
              ${pii.expiresAt ? `<span class="pii-expires">📅 ${pii.expiresAt.slice(0, 10)}</span>` : ''}
            </div>
          </div>`;
      }).join('');
      return `
        <div class="purpose-item">
          <div class="purpose-header">
            <input type="checkbox" name="purpose" value="${p.purposeUuid}" checked />
            <div class="purpose-text">
              <span class="purpose-name">${label}</span>
              ${p.description && p.description !== label ? `<span class="purpose-desc">${p.description}</span>` : ''}
            </div>
          </div>
          ${piisHtml ? `<div class="piis-list">${piisHtml}</div>` : ''}
        </div>`;
    }).join('');
  }

  private attachFormHandlers(widget: HTMLElement): void {
    widget.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
      const purposeBoxes = widget.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="purpose"]');
      const purposes = Array.from(purposeBoxes).map(cb => {
        const piiBoxes = widget.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][name="pii"][data-purpose="${cb.value}"]`
        );
        const piis = Array.from(piiBoxes).map(pii => ({
          piiUuid: pii.value,
          required: pii.dataset.required === 'true',
        }));
        return { purposeUuid: cb.value, piis };
      });
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

  private attachLanguageHandler(widget: HTMLElement, template: WidgetTemplate): void {
    const select = widget.querySelector<HTMLSelectElement>('[data-lang-select]');
    if (!select || !template.translations) return;

    select.addEventListener('change', () => {
      const lang = select.value;
      const t = lang !== 'en' ? template.translations![lang] : null;

      const headerEl = widget.querySelector<HTMLElement>('[data-field="header"]');
      const bodyEl = widget.querySelector<HTMLElement>('[data-field="body"]');

      if (headerEl) headerEl.textContent = t ? t.header : (template.header ?? '');
      if (bodyEl) bodyEl.textContent = t ? t.body : (template.body ?? '');
    });
  }

  private attachPrivacyHandler(widget: HTMLElement): void {
    const modal = widget.querySelector('[data-privacy-modal]');
    if (!modal) return;

    widget.querySelector('[data-privacy-toggle]')?.addEventListener('click', e => {
      e.preventDefault();
      modal.removeAttribute('hidden');
    });

    widget.querySelector('[data-privacy-close]')?.addEventListener('click', () => {
      modal.setAttribute('hidden', '');
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) modal.setAttribute('hidden', '');
    });
  }
}
