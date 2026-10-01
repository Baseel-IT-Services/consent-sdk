import type { StateData } from './StateManager.js';
import type { WidgetTemplate, WidgetPurposeItem, WidgetPrivacyNotice } from '@baseel/types';
import { translateText, stripHtml } from '../utils/translate.js';
import { sanitizeOtp } from './EmailVerification.js';
import type { EmailVerificationState } from './EmailVerification.js';

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

  .baseel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9998;
    padding: 16px;
  }

  .widget {
    background: var(--baseel-bg);
    border: 1px solid var(--baseel-border);
    border-radius: var(--baseel-radius);
    max-width: 520px;
    width: 100%;
    max-height: 90vh;
    overflow-x: hidden;
    overflow-y: auto;
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

  /* ── Widget close button ── */
  .widget-close-btn {
    position: absolute; top: 12px; right: 12px; z-index: 1;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    background: none; border: none; border-radius: 50%; font-size: 20px; line-height: 1;
    color: var(--baseel-muted); cursor: pointer; transition: background 0.15s;
  }
  .widget-close-btn:hover { background: rgba(0,0,0,0.06); color: var(--baseel-text); }

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
  .modal-title-row { display: flex; align-items: center; gap: 8px; }
  .modal-version {
    font-size: 11px; font-weight: 500; color: var(--baseel-muted);
    background: #f3f4f6; padding: 2px 8px; border-radius: 10px;
  }
  .footer-agree { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; }
  .footer-agree input[type="checkbox"] {
    width: 16px; height: 16px; margin-top: 1px; flex-shrink: 0;
    accent-color: var(--baseel-primary); cursor: pointer;
  }
  .footer-agree label { font-size: 12px; color: var(--baseel-muted); line-height: 1.5; cursor: pointer; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn:disabled:hover { opacity: 0.45; }
  .btn:focus-visible, .privacy-link:focus-visible, .link-btn:focus-visible {
    outline: 2px solid var(--baseel-primary); outline-offset: 2px;
  }

  /* ── Email verification ── */
  .verify-section { padding: 20px 24px; border-bottom: 1px solid var(--baseel-border); }
  .verify-text { font-size: 13px; color: var(--baseel-muted); line-height: 1.5; }
  .verify-email {
    font-size: 14px; font-weight: 600; color: var(--baseel-text);
    margin: 4px 0 14px; overflow-wrap: anywhere;
  }
  .verify-hint { font-size: 12px; color: var(--baseel-muted); margin-top: 10px; line-height: 1.5; }
  .otp-label { display: block; font-size: 13px; font-weight: 500; color: var(--baseel-text); margin-bottom: 8px; }
  .otp-inputs { display: flex; gap: 8px; margin-bottom: 14px; }
  .otp-input {
    flex: 1 1 0; min-width: 0; max-width: 44px; height: 46px;
    border: 1px solid var(--baseel-border); border-radius: 8px;
    font-size: 18px; font-weight: 600; text-align: center; color: var(--baseel-text);
    background: #fff; outline: none; font-family: inherit;
  }
  .otp-input:focus { border-color: var(--baseel-primary); box-shadow: 0 0 0 3px rgba(0,102,255,0.15); }
  .otp-input:disabled { background: #f9fafb; cursor: not-allowed; }
  .otp-input[aria-invalid="true"] { border-color: var(--baseel-danger); }
  .verify-resend { font-size: 12px; color: var(--baseel-muted); margin-top: 12px; line-height: 1.5; }
  .link-btn {
    color: var(--baseel-primary); text-decoration: underline; cursor: pointer; font-weight: 500;
    background: none; border: none; font-size: inherit; font-family: inherit; padding: 0;
  }
  .link-btn:disabled { color: var(--baseel-muted); cursor: not-allowed; text-decoration: none; }
  .link-btn[hidden], [data-resend-countdown][hidden] { display: none; }
  .verify-error {
    font-size: 12px; color: var(--baseel-danger); background: #fef2f2;
    border-radius: 8px; padding: 8px 10px; margin-top: 12px; line-height: 1.5;
  }
  .verify-success { font-size: 14px; font-weight: 600; color: var(--baseel-success); }
  @media (max-width: 420px) {
    .verify-section { padding: 16px; }
    .verify-btn { width: 100%; }
    .otp-inputs { gap: 6px; }
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Consent inputs that are frozen while email verification is shown, so the choices
// captured at "Agree & Save" are exactly what gets submitted.
const CONSENT_INPUT_SELECTOR =
  'input[name="purpose"], input[name="pii"], [data-agree-check], [data-action="accept"]';

const AUTO_CLOSE_DELAY_MS = 1200;

export class Renderer {
  private root: ShadowRoot;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.root = shadowRoot;
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.root.appendChild(style);
  }

  destroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.stopCountdown();
  }

  render(data: StateData): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.stopCountdown();

    const existing = this.root.querySelector('.baseel-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'baseel-overlay';

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
          this.attachNoticeLanguageHandler(widget, data.template.notice ?? data.template.privacyNotice);
        } else {
          widget.innerHTML = this.error('Template data is missing.');
        }
        break;
    }

    overlay.appendChild(widget);
    this.root.appendChild(overlay);

    // Consent has been granted and submitted — the dialog closes itself
    // rather than waiting for the host page to remove it.
    if (data.state === 'success') {
      this.closeTimer = setTimeout(() => {
        overlay.remove();
        this.closeTimer = null;
      }, AUTO_CLOSE_DELAY_MS);
    }
  }

  /**
   * Shows, updates or removes the email verification section of the ready dialog.
   * Only the section's slot is re-rendered, so the consent form (and the user's
   * selections) is left untouched.
   */
  renderVerification(v: EmailVerificationState | null): void {
    const widget = this.root.querySelector<HTMLElement>('.baseel-overlay .widget');
    const slot = widget?.querySelector<HTMLElement>('[data-verify-slot]');
    if (!widget || !slot) return;

    this.stopCountdown();

    if (!v) {
      slot.innerHTML = '';
      delete slot.dataset.otpGeneration;
      delete slot.dataset.status;
      this.setConsentLocked(widget, false);
      return;
    }

    const prevStatus = slot.dataset.status;
    const sameGeneration = slot.dataset.otpGeneration === String(v.otpGeneration);
    const keptOtp = sameGeneration ? this.readOtp(slot) : '';

    slot.innerHTML = this.verificationHtml(v);
    slot.dataset.otpGeneration = String(v.otpGeneration);
    slot.dataset.status = v.status;

    this.setConsentLocked(widget, true);
    this.attachVerificationHandlers(slot, v, keptOtp);
    this.startCountdown(slot, v);

    // Re-rendering drops focus, so put it where the user's next action is.
    if (!prevStatus) {
      slot.scrollIntoView?.({ block: 'nearest' });
    }
    if (v.status === 'required') {
      slot.querySelector<HTMLButtonElement>('[data-otp-send]')?.focus();
    } else if (v.status === 'otp_sent') {
      const inputs = Array.from(slot.querySelectorAll<HTMLInputElement>('.otp-input'));
      const firstEmpty = inputs.find(input => !input.value);
      if (firstEmpty) firstEmpty.focus();
      else slot.querySelector<HTMLButtonElement>('[data-otp-verify]')?.focus();
    }
  }

  private verificationHtml(v: EmailVerificationState): string {
    const email = escapeHtml(v.email);
    const heading = `<h3 class="section-title" id="baseel-verify-title">Verify your email</h3>`;
    const errorHtml = v.error
      ? `<p class="verify-error" id="baseel-otp-error" role="alert"><span aria-hidden="true">&#9888;</span> ${escapeHtml(v.error.message)}</p>`
      : '';

    if (v.status === 'verified') {
      return `
        <section class="verify-section" aria-labelledby="baseel-verify-title">
          ${heading}
          <p class="verify-success" role="status"><span aria-hidden="true">&#10003;</span> Email verified successfully</p>
          <p class="verify-email">${email}</p>
        </section>`;
    }

    // Nothing sent yet: first "Send OTP" step.
    if (v.resendAvailableAt === null) {
      const sending = v.status === 'sending';
      const badEmail = v.error?.kind === 'invalid_email';
      return `
        <section class="verify-section" aria-labelledby="baseel-verify-title">
          ${heading}
          <p class="verify-text">We need to verify your email before collecting your consent.</p>
          <p class="verify-email">${email}</p>
          <button type="button" class="btn btn-primary verify-btn" data-otp-send
            ${sending ? 'disabled aria-busy="true"' : badEmail ? 'disabled' : ''}>${sending ? 'Sending OTP...' : 'Send OTP'}</button>
          <p class="verify-hint">An OTP will be sent to your registered email address.</p>
          ${errorHtml}
        </section>`;
    }

    const verifying = v.status === 'verifying';
    const resending = v.status === 'sending';
    const inputAttrs = [
      verifying || resending ? 'disabled' : '',
      v.error?.kind === 'invalid' ? 'aria-invalid="true"' : '',
      v.error ? 'aria-describedby="baseel-otp-error"' : '',
    ].join(' ');
    const inputsHtml = Array.from({ length: v.otpLength }, (_, i) => `
      <input class="otp-input" type="text" inputmode="numeric" pattern="[0-9]*"
        autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
        aria-label="Digit ${i + 1} of ${v.otpLength}" data-otp-index="${i}" ${inputAttrs} />`).join('');

    return `
      <section class="verify-section" aria-labelledby="baseel-verify-title">
        ${heading}
        <p class="verify-text">We sent a verification code to:</p>
        <p class="verify-email">${email}</p>
        <span class="otp-label" id="baseel-otp-label">Enter OTP</span>
        <div class="otp-inputs" role="group" aria-labelledby="baseel-otp-label">${inputsHtml}</div>
        <button type="button" class="btn btn-primary verify-btn" data-otp-verify disabled
          ${verifying ? 'aria-busy="true"' : ''}>${verifying ? 'Verifying...' : 'Verify OTP'}</button>
        <p class="verify-resend">
          Didn't receive the OTP?
          <span data-resend-countdown hidden></span>
          <button type="button" class="link-btn" data-otp-resend hidden
            ${resending ? 'aria-busy="true"' : ''}>${resending ? 'Resending...' : 'Resend OTP'}</button>
        </p>
        ${errorHtml}
      </section>`;
  }

  private attachVerificationHandlers(slot: HTMLElement, v: EmailVerificationState, keptOtp: string): void {
    // composed: false — these events (the verify one carries the OTP) stop at the
    // shadow root, where the component listens, and never reach the host page.
    const emit = (name: string, detail?: unknown) =>
      slot.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: false }));

    slot.querySelector<HTMLButtonElement>('[data-otp-send]')?.addEventListener('click', e => {
      (e.currentTarget as HTMLButtonElement).disabled = true;
      emit('baseel:internal:otp-send');
    });

    slot.querySelector<HTMLButtonElement>('[data-otp-resend]')?.addEventListener('click', e => {
      (e.currentTarget as HTMLButtonElement).disabled = true;
      emit('baseel:internal:otp-resend');
    });

    const inputs = Array.from(slot.querySelectorAll<HTMLInputElement>('.otp-input'));
    const verifyBtn = slot.querySelector<HTMLButtonElement>('[data-otp-verify]');
    if (!inputs.length || !verifyBtn) return;

    const len = inputs.length;
    const syncVerifyButton = () => {
      verifyBtn.disabled = v.status !== 'otp_sent' || this.readOtp(slot).length !== len;
    };
    const fillFrom = (start: number, digits: string) => {
      let i = start;
      for (const digit of digits) {
        if (i >= len) break;
        inputs[i++].value = digit;
      }
      inputs[Math.min(i, len - 1)].focus();
    };

    keptOtp.split('').forEach((digit, i) => {
      if (inputs[i]) inputs[i].value = digit;
    });

    inputs.forEach((input, index) => {
      // Selecting on focus makes typing replace the digit instead of appending to it.
      input.addEventListener('focus', () => input.select());

      input.addEventListener('input', () => {
        const digits = sanitizeOtp(input.value, len);
        if (digits.length > 1) {
          // Browser/SMS autofill or a mobile paste delivers several digits at once.
          fillFrom(digits.length >= len ? 0 : index, digits);
        } else {
          input.value = digits;
          if (digits && index < len - 1) inputs[index + 1].focus();
        }
        syncVerifyButton();
      });

      input.addEventListener('paste', e => {
        e.preventDefault();
        const digits = sanitizeOtp(e.clipboardData?.getData('text') ?? '', len);
        if (!digits) return;
        fillFrom(digits.length >= len ? 0 : index, digits);
        syncVerifyButton();
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          e.preventDefault();
          inputs[index - 1].value = '';
          inputs[index - 1].focus();
          syncVerifyButton();
        } else if (e.key === 'ArrowLeft' && index > 0) {
          e.preventDefault();
          inputs[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < len - 1) {
          e.preventDefault();
          inputs[index + 1].focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (!verifyBtn.disabled) verifyBtn.click();
        }
      });
    });

    verifyBtn.addEventListener('click', () => {
      const otp = this.readOtp(slot);
      if (otp.length !== len) return;
      verifyBtn.disabled = true;
      emit('baseel:internal:otp-verify', { otp });
    });

    syncVerifyButton();
  }

  private readOtp(slot: HTMLElement): string {
    const inputs = Array.from(slot.querySelectorAll<HTMLInputElement>('.otp-input'));
    return sanitizeOtp(inputs.map(input => input.value).join(''), inputs.length);
  }

  private startCountdown(slot: HTMLElement, v: EmailVerificationState): void {
    const countdown = slot.querySelector<HTMLElement>('[data-resend-countdown]');
    const resendBtn = slot.querySelector<HTMLButtonElement>('[data-otp-resend]');
    if (!countdown || !resendBtn || v.resendAvailableAt === null) return;

    const availableAt = v.resendAvailableAt;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
      if (remaining > 0) {
        countdown.hidden = false;
        countdown.textContent = `Resend OTP in ${remaining} second${remaining === 1 ? '' : 's'}`;
        resendBtn.hidden = true;
      } else {
        countdown.hidden = true;
        resendBtn.hidden = false;
        resendBtn.disabled = v.status !== 'otp_sent';
        this.stopCountdown();
      }
    };

    tick();
    if (resendBtn.hidden) this.countdownTimer = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private setConsentLocked(widget: HTMLElement, locked: boolean): void {
    widget.querySelectorAll<HTMLInputElement | HTMLButtonElement>(CONSENT_INPUT_SELECTOR).forEach(el => {
      if (locked) {
        if (!el.disabled) {
          el.disabled = true;
          el.dataset.verifyLocked = 'true';
        }
      } else if (el.dataset.verifyLocked) {
        el.disabled = false;
        delete el.dataset.verifyLocked;
      }
    });

    if (!locked) {
      const agreeCheck = widget.querySelector<HTMLInputElement>('[data-agree-check]');
      const acceptBtn = widget.querySelector<HTMLButtonElement>('[data-action="accept"]');
      if (agreeCheck && acceptBtn) acceptBtn.disabled = !agreeCheck.checked;
    }
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

  private langOptions(): string {
    return Object.entries(LANG_NAMES)
      .map(([code, label]) => `<option value="${code}">${label}</option>`)
      .join('');
  }

  private ready(template: WidgetTemplate): string {
    const {
      logoUrl, title, status, version, legalEntityName,
      header, body, footer, purposes,
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

    // ── Language selector — always show all supported languages ──
    const langOptionsHtml = this.langOptions();
    const langSelectorHtml = `
      <div class="lang-row">
        <span class="lang-icon">🌐</span>
        <span class="lang-label">Language</span>
        <select class="lang-select" data-lang-select>
          ${langOptionsHtml}
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

    // ── Footer — checkbox agreement + Privacy Notice link ──
    const noticeObj = notice ?? privacyNotice;
    const privacyLinkHtml = `<button class="privacy-link" data-privacy-toggle data-field="notice-link">${noticeObj?.title ?? 'Privacy Notice'}</button>`;
    const footerText = footer ?? 'I agree to the terms and conditions';
    const footerHtml = `
      <div class="footer-agree">
        <input type="checkbox" id="baseel-agree-check" data-agree-check />
        <label for="baseel-agree-check"><span data-field="footer">${footerText}</span> ${privacyLinkHtml}</label>
      </div>`;

    // ── Privacy Notice Modal (only rendered when notice data exists) ──
    const modalHtml = noticeObj ? `
      <div class="modal-overlay" data-privacy-modal hidden>
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title-row">
              <span class="modal-title" data-field="notice-title">${noticeObj.title}</span>
              ${noticeObj.version ? `<span class="modal-version">v${noticeObj.version}</span>` : ''}
            </div>
            <button class="modal-close" data-privacy-close>×</button>
          </div>
          <div class="lang-row">
            <span class="lang-icon">🌐</span>
            <span class="lang-label">Language</span>
            <select class="lang-select" data-notice-lang-select>
              ${this.langOptions()}
            </select>
          </div>
          <div class="modal-body" data-field="notice-content">${noticeObj.content}</div>
          ${(noticeObj.effectiveFrom || noticeObj.effectiveTo) ? `
          <div class="modal-footer">
            ${noticeObj.effectiveFrom ? `From ${noticeObj.effectiveFrom}` : ''}
            ${noticeObj.effectiveTo ? ` · until ${noticeObj.effectiveTo}` : ''}
          </div>` : ''}
        </div>
      </div>` : '';

    return `
      <button class="widget-close-btn" data-action="deny" aria-label="Close">&times;</button>
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
      <div data-verify-slot></div>
      <div class="footer-section">
        ${footerHtml}
        <div class="actions">
          <button class="btn btn-secondary" data-action="deny">Cancel</button>
          <button class="btn btn-primary" data-action="accept" disabled>Agree &amp; Save</button>
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
    const agreeCheck = widget.querySelector<HTMLInputElement>('[data-agree-check]');
    const acceptBtn = widget.querySelector<HTMLButtonElement>('[data-action="accept"]');
    if (agreeCheck && acceptBtn) {
      agreeCheck.addEventListener('change', () => {
        acceptBtn.disabled = !agreeCheck.checked;
      });
    }

    widget.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
      const purposeBoxes = widget.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="purpose"]');
      const purposes = Array.from(purposeBoxes)
        .filter(cb => cb.checked)
        .map(cb => {
          const piiBoxes = widget.querySelectorAll<HTMLInputElement>(
            `input[type="checkbox"][name="pii"][data-purpose="${cb.value}"]`
          );
          const piis = Array.from(piiBoxes)
            .filter(pii => pii.checked)
            .map(pii => ({
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

    widget.querySelectorAll('[data-action="deny"]').forEach((el) => {
      el.addEventListener('click', () => {
        widget.dispatchEvent(new CustomEvent('baseel:internal:deny', { bubbles: true, composed: true }));
      });
    });
  }

  private attachLanguageHandler(widget: HTMLElement, template: WidgetTemplate): void {
    const select = widget.querySelector<HTMLSelectElement>('[data-lang-select]');
    if (!select) return;

    const original = {
      header: template.header ?? '',
      body: template.body ?? '',
      footer: template.footer ?? 'I agree to the terms and conditions',
    };

    type Translated = typeof original;

    // Cache resolved translations per language so re-selecting a language is instant.
    const cache = new Map<string, Translated>([['en', original]]);

    const applyText = (t: Translated) => {
      const headerEl = widget.querySelector<HTMLElement>('[data-field="header"]');
      const bodyEl = widget.querySelector<HTMLElement>('[data-field="body"]');
      const footerEl = widget.querySelector<HTMLElement>('[data-field="footer"]');

      if (headerEl) headerEl.textContent = t.header;
      if (bodyEl) bodyEl.textContent = t.body;
      if (footerEl) footerEl.textContent = t.footer;
    };

    // Resolves header/body/footer from the backend translation record when available,
    // falling back to live Google Translate — the same mechanism used in the CMP platform
    // and dummy app.
    const resolveTranslation = async (lang: string): Promise<Translated> => {
      const stored = template.translations?.[lang];
      if (stored) return { header: stored.header, body: stored.body, footer: stored.footer };

      const [header, body, footer] = await Promise.all([
        translateText(original.header, lang),
        translateText(original.body, lang),
        translateText(original.footer, lang),
      ]);
      return { header, body, footer };
    };

    select.addEventListener('change', async () => {
      const lang = select.value;

      const cached = cache.get(lang);
      if (cached) {
        applyText(cached);
        return;
      }

      select.disabled = true;
      try {
        const t = await resolveTranslation(lang);
        cache.set(lang, t);
        applyText(t);
      } catch {
        applyText(original);
        select.value = 'en';
      } finally {
        select.disabled = false;
      }
    });
  }

  private attachNoticeLanguageHandler(widget: HTMLElement, noticeObj: WidgetPrivacyNotice | undefined): void {
    const select = widget.querySelector<HTMLSelectElement>('[data-notice-lang-select]');
    if (!select || !noticeObj) return;

    const originalContentHtml = noticeObj.content;
    const original = {
      title: noticeObj.title,
      content: stripHtml(noticeObj.content),
    };

    type Translated = typeof original;

    // Cache resolved translations per language so re-selecting a language is instant.
    // Independent from the main widget language selector — the notice can be read in a
    // different language than the header/body/footer content.
    const cache = new Map<string, Translated>([['en', original]]);

    const applyText = (t: Translated, lang: string) => {
      const titleEl = widget.querySelector<HTMLElement>('[data-field="notice-title"]');
      const linkEl = widget.querySelector<HTMLElement>('[data-field="notice-link"]');
      const contentEl = widget.querySelector<HTMLElement>('[data-field="notice-content"]');

      if (titleEl) titleEl.textContent = t.title;
      if (linkEl) linkEl.textContent = t.title || 'Privacy Notice';
      if (contentEl) {
        // 'en' keeps the original rich HTML; translated text is plain, so swap to textContent.
        if (lang === 'en') contentEl.innerHTML = originalContentHtml;
        else contentEl.textContent = t.content;
      }
    };

    select.addEventListener('change', async () => {
      const lang = select.value;

      const cached = cache.get(lang);
      if (cached) {
        applyText(cached, lang);
        return;
      }

      select.disabled = true;
      try {
        const [title, content] = await Promise.all([
          translateText(original.title, lang),
          translateText(original.content, lang),
        ]);
        const t = { title, content };
        cache.set(lang, t);
        applyText(t, lang);
      } catch {
        applyText(original, 'en');
        select.value = 'en';
      } finally {
        select.disabled = false;
      }
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
