import type { WidgetTemplate } from '@baseel/types';

export interface SubmitPurpose {
  uuid: string;
  accepted: boolean;
}

export async function submitConsent(
  templateUuid: string,
  sessionToken: string,
  purposes: SubmitPurpose[],
  apiBaseUrl: string
): Promise<{ consentId?: string }> {
  const url = `${apiBaseUrl}/api/widget/consent/submit`;

  const token = sessionToken.startsWith('Bearer ')
    ? sessionToken.slice(7).trim()
    : sessionToken.trim();

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ templateUuid, purposes }),
    });
  } catch {
    throw new Error('Network error: unable to reach the consent server.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid or expired session token.');
  }

  if (!response.ok) {
    throw new Error(`Consent submission failed (HTTP ${response.status}).`);
  }

  const data = await response.json().catch(() => ({}));
  return { consentId: data?.consentId ?? data?.uuid ?? data?.id };
}

export async function getConsentScreen(
  screenId: string,
  publicKey: string,
  sessionToken: string,
  apiBaseUrl: string
): Promise<WidgetTemplate> {
  const url =
    `${apiBaseUrl}/api/template/${encodeURIComponent(screenId)}` +
    `?key=${encodeURIComponent(publicKey)}&token=${encodeURIComponent(sessionToken)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Network error: unable to reach the consent server.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid or expired session token.');
  }

  if (!response.ok) {
    throw new Error(`Failed to load consent screen (HTTP ${response.status}).`);
  }

  const data = await response.json();

  // Spring Boot wraps the template: { template: {...} } or returns it directly
  const raw: WidgetTemplate = data.template ?? data;

  if (!raw?.uuid) {
    throw new Error('Invalid response: consent screen data is missing.');
  }

  return {
    ...raw,
    // Normalize logoUrl — may live at top level or inside branding
    logoUrl: raw.logoUrl ?? (raw as any).branding?.logoUrl,
  };
}
