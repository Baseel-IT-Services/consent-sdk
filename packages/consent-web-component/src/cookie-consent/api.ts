import { CookieConsentError } from './types.js';

const REQUEST_TIMEOUT_MS = 10_000;

/** Body of the save request (POST `endpoints.saveConsent`, default /api/v1/cookie-consents). */
export interface CookieConsentSyncPayload {
  browserId: string;
  categories: Record<string, boolean>;
  configVersion: string;
  consentedAt: string;
  userAgent: string;
}

interface Endpoint {
  /** Full URL of the save endpoint. */
  url: string;
  siteKey: string;
  userToken: string;
}

function bearer(token: string): string {
  return token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
}

function errorForStatus(status: number): CookieConsentError {
  if (status === 401) return new CookieConsentError('UNAUTHORIZED', 'User token is invalid or expired.', status);
  if (status === 403) return new CookieConsentError('FORBIDDEN', 'Request rejected: unknown site key or origin not allowed for this site.', status);
  if (status === 429) return new CookieConsentError('RATE_LIMITED', 'Too many requests; will retry later.', status);
  return new CookieConsentError('SERVER_ERROR', `Consent Manager responded with HTTP ${status}.`, status);
}

/** Network failures, rate limiting and 5xx are worth retrying; auth and validation errors are not. */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof CookieConsentError)) return true;
  if (err.code === 'NETWORK_ERROR' || err.code === 'RATE_LIMITED') return true;
  return err.code === 'SERVER_ERROR' && (err.status === undefined || err.status >= 500);
}

async function request(url: string, init: RequestInit, endpoint: Endpoint): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${bearer(endpoint.userToken)}`,
        'X-Publishable-Key': endpoint.siteKey,
      },
    });
  } catch {
    throw new CookieConsentError('NETWORK_ERROR', 'Unable to reach Consent Manager.');
  } finally {
    clearTimeout(timer);
  }
}

export async function saveCookieConsent(endpoint: Endpoint, payload: CookieConsentSyncPayload): Promise<void> {
  const response = await request(
    endpoint.url,
    { method: 'POST', body: JSON.stringify(payload) },
    endpoint
  );
  if (!response.ok) throw errorForStatus(response.status);
}

