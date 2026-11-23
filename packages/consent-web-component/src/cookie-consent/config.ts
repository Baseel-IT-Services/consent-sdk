import { DEFAULT_API_BASE_URL } from '../constants.js';
import { CookieConsentError } from './types.js';
import type {
  CookieBannerContent,
  CookieBannerLayout,
  CookieBannerPosition,
  CookieCategory,
  CookieConsentConfig,
} from './types.js';

const LAYOUTS: readonly CookieBannerLayout[] = ['bar', 'box'];
const POSITIONS: readonly CookieBannerPosition[] = ['bottom', 'top', 'bottom-left', 'bottom-right'];
const CATEGORY_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const DEFAULT_SAVE_CONSENT_PATH = '/api/v1/cookie-consents';

// Only English ships for now; which other languages to include is an open point.
const DEFAULT_CONTENT: Required<Omit<CookieBannerContent, 'privacyPolicyUrl'>> = {
  title: 'We use cookies',
  message: 'We use cookies to run this site and, with your consent, to analyse traffic and personalise content.',
  acceptAllText: 'Accept all',
  rejectText: 'Reject optional',
  customiseText: 'Customise',
  preferencesTitle: 'Cookie preferences',
  saveText: 'Save preferences',
  alwaysActiveText: 'Always active',
  privacyPolicyText: 'Privacy policy',
  floatingButtonLabel: 'Cookie settings',
  closeLabel: 'Close',
};

export interface ResolvedTheme {
  layout: CookieBannerLayout;
  position: CookieBannerPosition;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
  showFloatingButton: boolean;
}

export interface ResolvedConfig {
  siteKey: string;
  categories: CookieCategory[];
  content: Required<Omit<CookieBannerContent, 'privacyPolicyUrl'>> & { privacyPolicyUrl: string | null };
  language: string;
  theme: ResolvedTheme;
  userToken: string | null;
  apiBaseUrl: string;
  /** Full URLs, already joined to `apiBaseUrl`. */
  endpoints: { saveConsent: string };
  debug: boolean;
  configVersion: string;
}

function invalid(message: string): CookieConsentError {
  return new CookieConsentError('INVALID_CONFIG', `[CookieConsent] ${message}`);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Only http(s) links are rendered, so a `javascript:` URL can never reach an href. */
export function safeUrl(value: unknown): string | null {
  if (!nonEmpty(value)) return null;
  try {
    const base = typeof location !== 'undefined' ? location.href : 'https://localhost/';
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Short, stable hash of the category set. Stored with each choice so a later change to the
 * merchant's categories can be detected. FNV-1a: synchronous and dependency-free.
 */
export function computeConfigVersion(categories: CookieCategory[]): string {
  const canonical = categories
    .map(c => `${c.id}:${c.required ? 1 : 0}`)
    .sort()
    .join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** A path is joined to the API base URL; an absolute URL must be http(s). */
function resolveEndpoint(name: string, value: unknown, fallback: string, apiBaseUrl: string): string {
  if (value === undefined || value === null) value = fallback;
  if (!nonEmpty(value)) throw invalid(`endpoints.${name} must be a non-empty path or URL.`);
  const trimmed = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) throw invalid(`endpoints.${name} must be an http(s) URL or a path.`);
    return trimmed;
  }
  return `${apiBaseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function resolveConfig(config: CookieConsentConfig): ResolvedConfig {
  if (!config || typeof config !== 'object') throw invalid('A configuration object is required.');
  if (!nonEmpty(config.siteKey)) throw invalid('"siteKey" is required and must be a non-empty string.');
  if (!Array.isArray(config.categories) || config.categories.length === 0) {
    throw invalid('"categories" is required and must contain at least one category.');
  }

  const seen = new Set<string>();
  const categories = config.categories.map((c, i): CookieCategory => {
    if (!c || !nonEmpty(c.id) || !CATEGORY_ID.test(c.id)) {
      throw invalid(`categories[${i}].id must be 1-64 letters, digits, "_" or "-".`);
    }
    if (seen.has(c.id)) throw invalid(`Duplicate category id "${c.id}".`);
    seen.add(c.id);
    if (!nonEmpty(c.label)) throw invalid(`categories[${i}].label is required.`);
    return {
      id: c.id,
      label: c.label,
      description: nonEmpty(c.description) ? c.description : undefined,
      required: c.required === true,
    };
  });

  const theme = config.theme ?? {};
  if (theme.layout !== undefined && !LAYOUTS.includes(theme.layout)) {
    throw invalid(`theme.layout must be one of: ${LAYOUTS.join(', ')}.`);
  }
  if (theme.position !== undefined && !POSITIONS.includes(theme.position)) {
    throw invalid(`theme.position must be one of: ${POSITIONS.join(', ')}.`);
  }

  if (config.endpoints !== undefined && (config.endpoints === null || typeof config.endpoints !== 'object')) {
    throw invalid('"endpoints" must be an object.');
  }
  const apiBaseUrl = (nonEmpty(config.apiBaseUrl) ? config.apiBaseUrl : DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  const endpoints = config.endpoints ?? {};

  const content = config.content ?? {};
  const pick = (key: keyof typeof DEFAULT_CONTENT): string =>
    nonEmpty(content[key]) ? content[key]! : DEFAULT_CONTENT[key];

  return {
    siteKey: config.siteKey.trim(),
    categories,
    content: {
      title: pick('title'),
      message: pick('message'),
      acceptAllText: pick('acceptAllText'),
      rejectText: pick('rejectText'),
      customiseText: pick('customiseText'),
      preferencesTitle: pick('preferencesTitle'),
      saveText: pick('saveText'),
      alwaysActiveText: pick('alwaysActiveText'),
      privacyPolicyText: pick('privacyPolicyText'),
      floatingButtonLabel: pick('floatingButtonLabel'),
      closeLabel: pick('closeLabel'),
      privacyPolicyUrl: safeUrl(content.privacyPolicyUrl),
    },
    language: nonEmpty(config.language) ? config.language : 'en',
    theme: {
      layout: theme.layout ?? 'bar',
      position: theme.position ?? 'bottom',
      primaryColor: nonEmpty(theme.primaryColor) ? theme.primaryColor : '#0A7C7C',
      backgroundColor: nonEmpty(theme.backgroundColor) ? theme.backgroundColor : '#FFFFFF',
      textColor: nonEmpty(theme.textColor) ? theme.textColor : '#1F2937',
      fontFamily: nonEmpty(theme.fontFamily) ? theme.fontFamily : 'inherit',
      fontSize: nonEmpty(theme.fontSize) ? theme.fontSize : '14px',
      borderRadius: nonEmpty(theme.borderRadius) ? theme.borderRadius : '8px',
      showFloatingButton: theme.showFloatingButton !== false,
    },
    userToken: nonEmpty(config.userToken) ? config.userToken.trim() : null,
    apiBaseUrl,
    endpoints: {
      saveConsent: resolveEndpoint('saveConsent', endpoints.saveConsent, DEFAULT_SAVE_CONSENT_PATH, apiBaseUrl),
    },
    debug: config.debug === true,
    configVersion: computeConfigVersion(categories),
  };
}

/**
 * Applies the category rules to a set of choices: required categories are always on,
 * unknown ids are dropped, and anything not explicitly chosen is off.
 */
export function normalizeChoices(
  categories: CookieCategory[],
  choices: Record<string, unknown> | null | undefined
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const c of categories) {
    result[c.id] = c.required || choices?.[c.id] === true;
  }
  return result;
}
