import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConsentScreen, submitConsent } from './consent.js';

const API = 'http://api.test';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function submit() {
  return submitConsent('tpl-1', 1, 'en', 'pk_test', 'session-token', [], API);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitConsent', () => {
  it('returns the consent id on success', async () => {
    mockFetch(200, { consentId: 'c-1' });
    await expect(submit()).resolves.toEqual({ consentId: 'c-1' });
  });

  it('shows the backend message for a duplicate submission', async () => {
    mockFetch(400, { status: 400, error: 'Bad Request', message: 'Consent already submitted' });
    await expect(submit()).rejects.toThrow('Consent already submitted');
  });

  it('shows the backend message for any other error status', async () => {
    mockFetch(409, { status: 409, error: 'Conflict', message: 'Widget session token has already been used' });
    await expect(submit()).rejects.toThrow('Widget session token has already been used');
  });

  it('falls back to the status code when the body is not JSON', async () => {
    mockFetch(400, new Error('not json'));
    await expect(submit()).rejects.toThrow('Consent submission failed (HTTP 400).');
  });

  it('falls back to the status code when the body has no message', async () => {
    mockFetch(500, { error: 'Internal Server Error' });
    await expect(submit()).rejects.toThrow('Consent submission failed (HTTP 500).');
  });

  it('shows the backend message for 401/403', async () => {
    mockFetch(401, { message: 'Widget session has expired' });
    await expect(submit()).rejects.toThrow('Widget session has expired');
  });

  it('falls back to the session-token message for 401/403 without a body message', async () => {
    mockFetch(403, {});
    await expect(submit()).rejects.toThrow('Invalid or expired session token.');
  });
});

describe('getConsentScreen', () => {
  function load() {
    return getConsentScreen('CT_001', 'pk_test', 'session-token', API);
  }

  it('shows the backend message when the screen cannot be loaded', async () => {
    mockFetch(404, { message: 'Consent template not found' });
    await expect(load()).rejects.toThrow('Consent template not found');
  });

  it('falls back to the status code when the body has no message', async () => {
    mockFetch(500, new Error('not json'));
    await expect(load()).rejects.toThrow('Failed to load consent screen (HTTP 500).');
  });
});
