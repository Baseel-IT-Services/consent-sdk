import { ATTR, ELEMENT_TAG, DEFAULT_API_BASE_URL, EMAIL_OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from '../constants.js';
import { StateManager } from './StateManager.js';
import type { StateData } from './StateManager.js';
import { Renderer } from './Renderer.js';
import { getConsentScreen, submitConsent } from '../api/consent.js';
import type { SubmitPurpose } from '../api/consent.js';
import { EmailOtpError, requestEmailOtp, resendEmailOtp, verifyEmailOtp } from '../api/emailVerification.js';
import type { EmailOtpErrorKind } from '../api/emailVerification.js';
import { isValidEmail, isValidOtp, normalizeEmail, sanitizeOtp } from './EmailVerification.js';
import type { EmailVerificationState } from './EmailVerification.js';
import { dispatchConsentGranted, dispatchConsentDenied, dispatchConsentError } from '../events/events.js';

export interface ComponentConfig {
  publicKey: string;
  sessionToken: string;
  screenId: string;
  apiBaseUrl: string;
  /** Present when the host requires email OTP verification before consent is submitted. */
  email?: string;
}

// How long "Email verified successfully" stays visible before consent is submitted.
const VERIFIED_SUBMIT_DELAY_MS = 900;

// Falls back to a plain class when `HTMLElement` doesn't exist (SSR/Node) so that merely
// importing this module never throws — only actually defining/using the custom element
// requires a real browser, which register.ts's `customElements` guard already handles.
const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class BaseelConsent extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return [ATTR.PUBLIC_KEY, ATTR.SESSION_TOKEN, ATTR.SCREEN_ID, ATTR.API_BASE_URL, ATTR.EMAIL];
  }

  private stateManager = new StateManager();
  private renderer: Renderer | null = null;
  private fetchGen = 0;
  private onStateChange = (data: StateData): void => this.renderer?.render(data);

  // ── Email verification ──
  // Lives only in memory for this element: never written to storage, and reset whenever
  // the dialog is dismissed or its email/session changes.
  private verification: EmailVerificationState | null = null;
  private verifiedEmail: string | null = null;
  private otpChallengeId: string | undefined;
  // Consent choices captured at "Agree & Save", submitted unchanged once verified.
  // The renderer locks the consent inputs while verification is shown.
  private pendingPurposes: SubmitPurpose[] | null = null;
  // Bumped on reset so responses from an abandoned OTP flow are ignored.
  private verificationGen = 0;
  private verifiedSubmitTimer: ReturnType<typeof setTimeout> | null = null;
  private submitInFlight = false;

  private handleAccept = (e: Event): void => {
    const purposes = (e as CustomEvent<{ purposes: SubmitPurpose[] }>).detail.purposes;
    const config = this.getConfig();
    const template = this.stateManager.getState().template;
    if (!config || !template) return;
    if (this.stateManager.getState().state !== 'ready' || this.verification) return;
    this.doSubmit(config, template.uuid, template.version, template.languageCode ?? 'en', purposes);
  };

  private handleDeny = (): void => {
    this.resetVerification();
    dispatchConsentDenied(this, { timestamp: Date.now() });
  };

  private handleOtpSend = (): void => {
    void this.sendOtp(false);
  };

  private handleOtpResend = (): void => {
    void this.sendOtp(true);
  };

  private handleOtpVerify = (e: Event): void => {
    const otp = (e as CustomEvent<{ otp: string }>).detail?.otp ?? '';
    void this.verifyOtp(otp);
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.renderer = new Renderer(this.shadowRoot!);
    this.stateManager.onChange(this.onStateChange);
    this.renderer.render(this.stateManager.getState());
    this.shadowRoot!.addEventListener('baseel:internal:accept', this.handleAccept);
    this.shadowRoot!.addEventListener('baseel:internal:deny', this.handleDeny);
    this.shadowRoot!.addEventListener('baseel:internal:otp-send', this.handleOtpSend);
    this.shadowRoot!.addEventListener('baseel:internal:otp-resend', this.handleOtpResend);
    this.shadowRoot!.addEventListener('baseel:internal:otp-verify', this.handleOtpVerify);
    this.bootstrap();
  }

  disconnectedCallback(): void {
    this.resetVerification();
    this.stateManager.offChange(this.onStateChange);
    this.shadowRoot!.removeEventListener('baseel:internal:accept', this.handleAccept);
    this.shadowRoot!.removeEventListener('baseel:internal:deny', this.handleDeny);
    this.shadowRoot!.removeEventListener('baseel:internal:otp-send', this.handleOtpSend);
    this.shadowRoot!.removeEventListener('baseel:internal:otp-resend', this.handleOtpResend);
    this.shadowRoot!.removeEventListener('baseel:internal:otp-verify', this.handleOtpVerify);
    this.renderer?.destroy();
    this.renderer = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    // A different email or session is a different data principal — a previous
    // verification must not carry over to it.
    if (name === ATTR.EMAIL || name === ATTR.SESSION_TOKEN) {
      this.verifiedEmail = null;
    }
    if (this.renderer) {
      this.bootstrap();
    }
  }

  getConfig(): ComponentConfig | null {
    const publicKey = this.getAttribute(ATTR.PUBLIC_KEY);
    const sessionToken = this.getAttribute(ATTR.SESSION_TOKEN);
    const screenId = this.getAttribute(ATTR.SCREEN_ID);
    const apiBaseUrl = this.getAttribute(ATTR.API_BASE_URL) ?? DEFAULT_API_BASE_URL;
    const email = this.getAttribute(ATTR.EMAIL)?.trim() || undefined;

    if (!publicKey || !sessionToken || !screenId) {
      const missing = [
        !publicKey && ATTR.PUBLIC_KEY,
        !sessionToken && ATTR.SESSION_TOKEN,
        !screenId && ATTR.SCREEN_ID,
      ].filter(Boolean).join(', ');

      console.error(`[${ELEMENT_TAG}] Missing required attributes: ${missing}`);
      return null;
    }

    return { publicKey, sessionToken, screenId, apiBaseUrl, email };
  }

  private async bootstrap(): Promise<void> {
    this.resetVerification();
    const config = this.getConfig();

    if (!config) {
      this.stateManager.set('error', {
        error: 'Missing required attributes: public-key, session-token, screen-id.',
      });
      return;
    }

    const gen = ++this.fetchGen;
    this.stateManager.set('loading');

    try {
      const template = await getConsentScreen(
        config.screenId,
        config.publicKey,
        config.sessionToken,
        config.apiBaseUrl
      );
      if (gen !== this.fetchGen) return;
      this.stateManager.set('ready', { template });
    } catch (err) {
      if (gen !== this.fetchGen) return;
      const message = err instanceof Error ? err.message : 'Failed to load consent screen.';
      this.stateManager.set('error', { error: message });
      dispatchConsentError(this, message);
    }
  }

  private isEmailVerified(config: ComponentConfig): boolean {
    if (!config.email) return true;
    return this.verifiedEmail !== null && this.verifiedEmail === normalizeEmail(config.email);
  }

  private async doSubmit(config: ComponentConfig, templateUuid: string, templateVersion: string | number, languageCode: string, purposes: SubmitPurpose[]): Promise<void> {
    if (this.submitInFlight) return;

    // Final gate at the submission layer — no UI state (double clicks, a stale button,
    // a manually dispatched accept event) can reach submitConsent() unverified.
    if (!this.isEmailVerified(config)) {
      this.startVerification(config.email!, purposes);
      return;
    }

    this.submitInFlight = true;
    this.pendingPurposes = null;
    this.stateManager.set('submitting');
    try {
      const result = await submitConsent(templateUuid, templateVersion, languageCode, config.publicKey, config.sessionToken, purposes, config.apiBaseUrl);
      this.stateManager.set('success');
      dispatchConsentGranted(this, {
        consentId: result.consentId,
        purposes: purposes.map(p => p.purposeUuid),
        timestamp: Date.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit consent.';
      this.stateManager.set('error', { error: message });
      dispatchConsentError(this, message);
    } finally {
      this.submitInFlight = false;
    }
  }

  // ── Email verification flow ──

  private startVerification(email: string, purposes: SubmitPurpose[]): void {
    this.pendingPurposes = purposes;
    if (this.verification) return; // already in progress — keep its state
    this.setVerification({
      status: 'required',
      email,
      otpLength: EMAIL_OTP_LENGTH,
      resendAvailableAt: null,
      otpGeneration: 0,
      // Surface a bad email up front; Send OTP stays disabled until the host fixes it.
      error: isValidEmail(email) ? null : this.otpError(null, 'invalid_email'),
    });
  }

  private setVerification(next: EmailVerificationState | null): void {
    this.verification = next;
    this.renderer?.renderVerification(next);
  }

  private resetVerification(): void {
    this.verificationGen++;
    if (this.verifiedSubmitTimer) {
      clearTimeout(this.verifiedSubmitTimer);
      this.verifiedSubmitTimer = null;
    }
    this.otpChallengeId = undefined;
    this.pendingPurposes = null;
    if (this.verification) this.setVerification(null);
  }

  private otpError(err: unknown, fallback: EmailOtpErrorKind): EmailVerificationState['error'] {
    const error = err instanceof EmailOtpError ? err : new EmailOtpError(fallback);
    return { kind: error.kind, message: error.message };
  }

  private async sendOtp(isResend: boolean): Promise<void> {
    const v = this.verification;
    const config = this.getConfig();
    if (!v || !config) return;
    if (v.status !== 'required' && v.status !== 'otp_sent') return; // a request is already in flight
    if (isResend && (v.resendAvailableAt === null || Date.now() < v.resendAvailableAt)) return;
    if (!isValidEmail(v.email)) {
      this.setVerification({ ...v, error: this.otpError(null, 'invalid_email') });
      return;
    }

    const gen = this.verificationGen;
    this.setVerification({ ...v, status: 'sending', error: null });

    try {
      const challenge = isResend
        ? await resendEmailOtp(v.email, config.apiBaseUrl)
        : await requestEmailOtp(v.email, config.apiBaseUrl);
      if (gen !== this.verificationGen || !this.verification) return;

      this.otpChallengeId = challenge.challengeId;
      this.setVerification({
        ...this.verification,
        status: 'otp_sent',
        resendAvailableAt: Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
        otpGeneration: this.verification.otpGeneration + 1,
        error: null,
      });
    } catch (err) {
      if (gen !== this.verificationGen || !this.verification) return;
      this.setVerification({
        ...this.verification,
        status: v.resendAvailableAt === null ? 'required' : 'otp_sent',
        error: this.otpError(err, 'request_failed'),
      });
    }
  }

  private async verifyOtp(rawOtp: string): Promise<void> {
    const v = this.verification;
    const config = this.getConfig();
    if (!v || !config || v.status !== 'otp_sent') return;

    const otp = sanitizeOtp(rawOtp, v.otpLength);
    if (!isValidOtp(otp, v.otpLength)) {
      this.setVerification({ ...v, error: this.otpError(null, 'invalid') });
      return;
    }

    const gen = this.verificationGen;
    this.setVerification({ ...v, status: 'verifying', error: null });

    try {
      await verifyEmailOtp(v.email, otp, this.otpChallengeId, config.apiBaseUrl);
      if (gen !== this.verificationGen || !this.verification) return;

      this.verifiedEmail = normalizeEmail(v.email);
      this.otpChallengeId = undefined;
      this.setVerification({ ...this.verification, status: 'verified', error: null });

      this.verifiedSubmitTimer = setTimeout(() => {
        this.verifiedSubmitTimer = null;
        this.submitAfterVerification();
      }, VERIFIED_SUBMIT_DELAY_MS);
    } catch (err) {
      if (gen !== this.verificationGen || !this.verification) return;
      const error = this.otpError(err, 'verify_failed');
      const current = this.verification;
      this.setVerification({
        ...current,
        status: 'otp_sent',
        error,
        // A wrong or expired code is useless — clear it. Keep it for transient failures
        // so the user can simply retry.
        otpGeneration: error?.kind === 'invalid' || error?.kind === 'expired'
          ? current.otpGeneration + 1
          : current.otpGeneration,
        // An expired code can be replaced straight away.
        resendAvailableAt: error?.kind === 'expired' ? Date.now() : current.resendAvailableAt,
      });
    }
  }

  private submitAfterVerification(): void {
    const config = this.getConfig();
    const template = this.stateManager.getState().template;
    const purposes = this.pendingPurposes;
    if (!config || !template || !purposes || this.stateManager.getState().state !== 'ready') return;

    this.verification = null; // the full re-render on 'submitting' replaces the section
    this.doSubmit(config, template.uuid, template.version, template.languageCode ?? 'en', purposes);
  }
}
