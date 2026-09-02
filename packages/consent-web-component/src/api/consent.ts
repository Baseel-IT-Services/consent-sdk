import type { WidgetTemplate } from '@baseel-sdk/types';

export interface SubmitPii {
  piiUuid: string;
  required: boolean;
}

export interface SubmitPurpose {
  purposeUuid: string;
  piis: SubmitPii[];
}

export async function submitConsent(
  templateUuid: string,
  templateVersion: string | number,
  languageCode: string,
  publicKey: string,
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
        'X-Publishable-Key': publicKey,
      },
      body: JSON.stringify({ templateUuid, templateVersion, languageCode, purposes }),
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
  const raw: any = data.template ?? data;

  if (!raw?.uuid) {
    throw new Error('Invalid response: consent screen data is missing.');
  }

  // Normalize purposes: API returns uuid, submit expects purposeUuid/piiUuid
  const purposes = (raw.purposes ?? []).map((p: any) => ({
    ...p,
    purposeUuid: p.purposeUuid ?? p.uuid,
    piis: (p.piis ?? []).map((pii: any) => ({
      ...pii,
      piiUuid: pii.piiUuid ?? pii.uuid,
    })),
  }));

  // Normalize translations: API may return an array; widget expects Record<languageCode, translation>
  let translations = raw.translations;
  if (Array.isArray(translations)) {
    translations = Object.fromEntries(
      (translations as any[]).map((t: any) => [t.languageCode ?? t.code, t])
    );
  }

  // Normalize privacy notice: handle different possible field names from API
  const notice = raw.notice ?? raw.privacyNotice ?? raw.privacy_notice ?? null;

  return {
    ...raw,
    logoUrl: raw.logoUrl ?? raw.branding?.logoUrl,
    legalEntityName: raw.legalEntityName ?? raw.legalEntity?.name,
    purposes,
    translations: translations ?? undefined,
    notice,
    privacyNotice: undefined,
  } as WidgetTemplate;
}
