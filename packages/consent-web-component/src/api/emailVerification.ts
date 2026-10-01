/**
 * Email OTP verification for the consent widget.
 *
 * Uses the platform's shared OTP endpoints with the CONSENT_VERIFICATION type:
 *   POST /api/otp/get-otp     { email, type }            — request (and resend) an OTP
 *   POST /api/otp/verify-otp  { email, otp, type, ... }  — verify the OTP
 *
 * get-otp also sets an OTP_TX challenge cookie, so both calls send credentials.
 * When get-otp returns a challengeId it is passed back explicitly as well, which
 * keeps verification working when the browser blocks the cookie.
 *
 * OTP values are never logged or persisted by this module.
 */

import { EMAIL_OTP_LENGTH } from '../constants.js';
import { isValidEmail, isValidOtp } from '../component/EmailVerification.js';

export const OTP_TYPE_CONSENT_VERIFICATION = 'CONSENT_VERIFICATION';

export type EmailOtpErrorKind =
  | 'invalid_email'
  | 'invalid'
  | 'expired'
  | 'rate_limited'
  | 'network'
  | 'request_failed'
  | 'verify_failed';

/** User-facing copy — technical details (status codes, server messages) are never shown. */
export const EMAIL_OTP_ERROR_MESSAGES: Record<EmailOtpErrorKind, string> = {
  invalid_email: 'Please provide a valid email address to receive the OTP.',
  invalid: 'Invalid OTP. Please enter the correct verification code.',
  expired: 'This OTP has expired. Please request a new OTP.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  network: 'Unable to reach the server. Please check your connection and try again.',
  request_failed: 'Unable to send OTP. Please try again.',
  verify_failed: 'Unable to verify the OTP. Please try again.',
};

export class EmailOtpError extends Error {
  readonly kind: EmailOtpErrorKind;

  constructor(kind: EmailOtpErrorKind) {
    super(EMAIL_OTP_ERROR_MESSAGES[kind]);
    this.name = 'EmailOtpError';
    this.kind = kind;
  }
}

export interface EmailOtpChallenge {
  challengeId?: string;
  /** Seconds until the challenge expires, when the server reports it. */
  expiresIn?: number;
}

// Server messages that mean the code can no longer be used and a new one is needed
// (OTPService: "The OTP session has ended…", "No active OTP found…", missing challenge).
const EXPIRED_PATTERN = /session has ended|expired|no active otp|challenge is required/i;
// Server messages for a wrong code ("The OTP entered is incorrect…", "Invalid OTP", "OTP is not valid…").
const INVALID_PATTERN = /incorrect|invalid otp|not valid/i;

interface OtpResponse {
  status: number;
  ok: boolean;
  data: Record<string, unknown>;
}

async function postOtp(url: string, body: Record<string, unknown>): Promise<OtpResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new EmailOtpError('network');
  }

  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    ok: response.ok,
    data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
  };
}

function serverMessage(data: Record<string, unknown>): string {
  return typeof data.message === 'string' ? data.message : '';
}

/**
 * Validates the get-otp success body: `{ message?, challengeId?, expiresIn? }`.
 * Both fields are optional (the challenge may be cookie-bound), but when present they
 * must be well-formed — a malformed challenge would make verification fail later.
 */
function parseChallenge(data: Record<string, unknown>): EmailOtpChallenge {
  const { challengeId, expiresIn } = data;

  if (challengeId !== undefined && challengeId !== null
      && (typeof challengeId !== 'string' || challengeId.trim() === '')) {
    throw new EmailOtpError('request_failed');
  }

  const validExpiry = typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0;

  return {
    challengeId: typeof challengeId === 'string' ? challengeId.trim() : undefined,
    expiresIn: validExpiry ? expiresIn : undefined,
  };
}

export async function requestEmailOtp(email: string, apiBaseUrl: string): Promise<EmailOtpChallenge> {
  const normalizedEmail = email.trim();
  if (!isValidEmail(normalizedEmail)) throw new EmailOtpError('invalid_email');

  const { ok, status, data } = await postOtp(`${apiBaseUrl}/api/otp/get-otp`, {
    email: normalizedEmail,
    type: OTP_TYPE_CONSENT_VERIFICATION,
  });

  if (status === 429) throw new EmailOtpError('rate_limited');
  if (!ok) throw new EmailOtpError('request_failed');

  return parseChallenge(data);
}

/** Resend uses the same get-otp endpoint — the server issues a fresh challenge. */
export function resendEmailOtp(email: string, apiBaseUrl: string): Promise<EmailOtpChallenge> {
  return requestEmailOtp(email, apiBaseUrl);
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  challengeId: string | undefined,
  apiBaseUrl: string
): Promise<void> {
  const normalizedEmail = email.trim();
  if (!isValidEmail(normalizedEmail)) throw new EmailOtpError('invalid_email');
  if (!isValidOtp(otp, EMAIL_OTP_LENGTH)) throw new EmailOtpError('invalid');

  const { ok, status, data } = await postOtp(`${apiBaseUrl}/api/otp/verify-otp`, {
    email: normalizedEmail,
    otp,
    type: OTP_TYPE_CONSENT_VERIFICATION,
    ...(challengeId ? { challengeId } : {}),
  });

  if (ok) return;

  if (status === 429) throw new EmailOtpError('rate_limited');

  const message = serverMessage(data);
  if (EXPIRED_PATTERN.test(message)) throw new EmailOtpError('expired');
  if (status === 401 || INVALID_PATTERN.test(message)) throw new EmailOtpError('invalid');
  throw new EmailOtpError('verify_failed');
}
