import type { EmailOtpErrorKind } from '../api/emailVerification.js';

/**
 * required  — verification needed, no OTP sent yet
 * sending   — get-otp in flight (first send, or a resend when resendAvailableAt is set)
 * otp_sent  — waiting for the user to enter the code
 * verifying — verify-otp in flight
 * verified  — email verified; consent submission is allowed
 */
export type EmailVerificationStatus = 'required' | 'sending' | 'otp_sent' | 'verifying' | 'verified';

export interface EmailVerificationState {
  status: EmailVerificationStatus;
  email: string;
  otpLength: number;
  /** Epoch ms when Resend becomes available; null until the first OTP is sent. */
  resendAvailableAt: number | null;
  /** Incremented whenever the entered code becomes stale, so the UI clears the inputs. */
  otpGeneration: number;
  error: { kind: EmailOtpErrorKind; message: string } | null;
}

// ── Schema validation ──
// Checked in the UI before any request and again in the API layer, so an invalid
// email or OTP never reaches the server.

const EMAIL_MAX_LENGTH = 254;
// local@domain.tld — no spaces, one @, a dot in the domain, 2+ letter TLD.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  return value.length > 0 && value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

/** Exactly `length` digits, nothing else. */
export function isValidOtp(otp: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(otp);
}

/** Keeps digits only (drops spaces, dashes, letters) and caps the length. */
export function sanitizeOtp(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
