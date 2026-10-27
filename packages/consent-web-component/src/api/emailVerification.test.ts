import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_OTP_ERROR_MESSAGES,
  EmailOtpError,
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
} from './emailVerification.js';

const API = 'http://api.test';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function errorKind(promise: Promise<unknown>) {
  const err = await promise.catch(e => e);
  expect(err).toBeInstanceOf(EmailOtpError);
  return (err as EmailOtpError).kind;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestEmailOtp', () => {
  it('posts email with CONSENT_VERIFICATION type and returns the challenge', async () => {
    const fetchFn = mockFetch(200, { message: 'OTP successfully sent on email!', challengeId: 'ch-1', expiresIn: 300 });

    await expect(requestEmailOtp('user@example.com', API)).resolves.toEqual({ challengeId: 'ch-1', expiresIn: 300 });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/otp/get-otp`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ email: 'user@example.com', type: 'CONSENT_VERIFICATION' });
  });

  it('shows the backend message on failure, keeping the error kind', async () => {
    mockFetch(400, { message: 'Email is not registered' });
    const err = (await requestEmailOtp('user@example.com', API).catch((e: unknown) => e)) as EmailOtpError;
    expect(err.kind).toBe('request_failed');
    expect(err.message).toBe('Email is not registered');

    mockFetch(429, { message: 'Too many requests' });
    const limited = (await requestEmailOtp('user@example.com', API).catch((e: unknown) => e)) as EmailOtpError;
    expect(limited.kind).toBe('rate_limited');
    expect(limited.message).toBe('Too many requests');
  });

  it('falls back to the default copy when the backend sends no message', async () => {
    mockFetch(500, {});
    const err = (await requestEmailOtp('user@example.com', API).catch((e: unknown) => e)) as EmailOtpError;
    expect(err.kind).toBe('request_failed');
    expect(err.message).toBe(EMAIL_OTP_ERROR_MESSAGES.request_failed);
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await errorKind(requestEmailOtp('user@example.com', API))).toBe('network');
  });

  it('resend uses the same get-otp endpoint', async () => {
    const fetchFn = mockFetch(200, { challengeId: 'ch-2' });
    await resendEmailOtp('user@example.com', API);
    expect(fetchFn.mock.calls[0][0]).toBe(`${API}/api/otp/get-otp`);
  });
});

describe('verifyEmailOtp', () => {
  it('posts email, otp, type and the challenge id', async () => {
    const fetchFn = mockFetch(200, { message: 'OTP verified successfully!' });

    await expect(verifyEmailOtp('user@example.com', '123456', 'ch-1', API)).resolves.toBeUndefined();

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${API}/api/otp/verify-otp`);
    expect(JSON.parse(init.body)).toEqual({
      email: 'user@example.com',
      otp: '123456',
      type: 'CONSENT_VERIFICATION',
      challengeId: 'ch-1',
    });
  });

  it('omits challengeId when none was issued (cookie-bound challenge)', async () => {
    const fetchFn = mockFetch(200, {});
    await verifyEmailOtp('user@example.com', '123456', undefined, API);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).not.toHaveProperty('challengeId');
  });

  it.each([
    [401, 'Invalid OTP', 'invalid'],
    [400, 'The OTP entered is incorrect. Please try again.', 'invalid'],
    [400, "The OTP session has ended. Please click 'Resend OTP' to get a new one.", 'expired'],
    [400, 'No active OTP found. Please request a new one.', 'expired'],
    [400, 'OTP challenge is required.', 'expired'],
    [429, 'Too many attempts', 'rate_limited'],
    [500, 'Internal Server Error', 'verify_failed'],
  ])('HTTP %i "%s" -> %s', async (status, message, kind) => {
    mockFetch(status, { message });
    expect(await errorKind(verifyEmailOtp('user@example.com', '123456', 'ch-1', API))).toBe(kind);
  });

  it('treats a non-JSON error body as a generic verify failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }));
    expect(await errorKind(verifyEmailOtp('user@example.com', '123456', 'ch-1', API))).toBe('verify_failed');
  });
});

describe('schema validation', () => {
  it('does not call get-otp for an invalid email', async () => {
    const fetchFn = mockFetch(200, {});
    expect(await errorKind(requestEmailOtp('not-an-email', API))).toBe('invalid_email');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('trims the email before sending', async () => {
    const fetchFn = mockFetch(200, { challengeId: 'ch-1' });
    await requestEmailOtp('  user@example.com  ', API);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).email).toBe('user@example.com');
  });

  it.each(['12345', '1234567', '12a456'])('does not call verify-otp for OTP "%s"', async otp => {
    const fetchFn = mockFetch(200, {});
    expect(await errorKind(verifyEmailOtp('user@example.com', otp, 'ch-1', API))).toBe('invalid');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects a malformed challengeId in the get-otp response', async () => {
    mockFetch(200, { challengeId: 42 });
    expect(await errorKind(requestEmailOtp('user@example.com', API))).toBe('request_failed');
  });

  it('ignores a non-positive expiresIn', async () => {
    mockFetch(200, { challengeId: 'ch-1', expiresIn: -5 });
    await expect(requestEmailOtp('user@example.com', API)).resolves.toEqual({ challengeId: 'ch-1', expiresIn: undefined });
  });
});