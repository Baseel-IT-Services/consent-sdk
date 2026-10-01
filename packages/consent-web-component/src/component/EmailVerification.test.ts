import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidOtp, normalizeEmail, sanitizeOtp } from './EmailVerification.js';

describe('sanitizeOtp', () => {
  it('keeps digits only', () => {
    expect(sanitizeOtp('12a3-4 5', 6)).toBe('12345');
  });

  it('trims spaces from a pasted code', () => {
    expect(sanitizeOtp('  123 456  ', 6)).toBe('123456');
  });

  it('caps the length', () => {
    expect(sanitizeOtp('1234567890', 6)).toBe('123456');
  });

  it('returns empty for no digits', () => {
    expect(sanitizeOtp('abc', 6)).toBe('');
  });
});

describe('normalizeEmail', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it.each(['user@example.com', 'ranik10245@gmail.com', 'first.last+tag@sub.domain.co.in', '  jo@maildrop.cc '])('accepts %s', email => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', '   ', 'user', 'user@', '@example.com', 'user@example', 'user @example.com', 'a@b@c.com', 'user@example.c', `${'a'.repeat(250)}@x.com`])('rejects "%s"', email => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('isValidOtp', () => {
  it('accepts exactly the required digits', () => {
    expect(isValidOtp('123456', 6)).toBe(true);
  });

  it.each(['12345', '1234567', '12a456', '123 456', ''])('rejects "%s"', otp => {
    expect(isValidOtp(otp, 6)).toBe(false);
  });
});