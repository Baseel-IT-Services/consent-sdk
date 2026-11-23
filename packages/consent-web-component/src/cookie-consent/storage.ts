const SCHEMA_VERSION = 1;
// Browsers cap cookie lifetime (Chrome: 400 days); the record itself has no expiry.
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** What the SDK keeps in the browser: one record per site. */
export interface StoredConsent {
  v: typeof SCHEMA_VERSION;
  siteKey: string;
  browserId: string;
  configVersion: string;
  categories: Record<string, boolean>;
  updatedAt: string;
  /** Saved while a registered user was identified. */
  registered: boolean;
  /** A registered user's choice that has not reached the backend yet. */
  pendingSync: boolean;
}

export interface KeyValueBackend {
  readonly kind: 'localStorage' | 'cookie' | 'memory';
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function storageKey(siteKey: string): string {
  return `baseel_cc_${siteKey.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function localStorageBackend(): KeyValueBackend | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__baseel_cc_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      kind: 'localStorage',
      get: key => ls.getItem(key),
      set: (key, value) => ls.setItem(key, value),
      remove: key => ls.removeItem(key),
    };
  } catch {
    return null; // blocked (private mode, browser setting) or quota exceeded
  }
}

function cookieBackend(): KeyValueBackend | null {
  try {
    if (typeof document === 'undefined' || typeof navigator === 'undefined' || !navigator.cookieEnabled) return null;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    const read = (key: string): string | null => {
      for (const part of document.cookie.split(';')) {
        const eq = part.indexOf('=');
        if (eq > -1 && part.slice(0, eq).trim() === key) {
          try {
            return decodeURIComponent(part.slice(eq + 1).trim());
          } catch {
            return null;
          }
        }
      }
      return null;
    };
    const probe = '__baseel_cc_probe__';
    document.cookie = `${probe}=1; path=/; SameSite=Lax${secure}`;
    const works = read(probe) === '1';
    document.cookie = `${probe}=; Max-Age=0; path=/`;
    if (!works) return null;
    return {
      kind: 'cookie',
      get: read,
      set: (key, value) => {
        document.cookie = `${key}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}`;
      },
      remove: key => {
        document.cookie = `${key}=; Max-Age=0; path=/`;
      },
    };
  } catch {
    return null;
  }
}

/** Last resort: the choice lasts for this page only. */
export function memoryBackend(): KeyValueBackend {
  const map = new Map<string, string>();
  return {
    kind: 'memory',
    get: key => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: key => void map.delete(key),
  };
}

/** localStorage first, then a first-party cookie, then memory. */
export function detectBackend(): KeyValueBackend {
  return localStorageBackend() ?? cookieBackend() ?? memoryBackend();
}

function isBooleanMap(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(v => typeof v === 'boolean');
}

/** Returns null for anything that is not a valid record of the current schema. */
export function parseStoredConsent(raw: string | null, siteKey: string): StoredConsent | null {
  if (!raw) return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !data ||
    data.v !== SCHEMA_VERSION ||
    data.siteKey !== siteKey ||
    typeof data.browserId !== 'string' ||
    data.browserId === '' ||
    typeof data.configVersion !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(data.updatedAt)) ||
    !isBooleanMap(data.categories)
  ) {
    return null;
  }
  return {
    v: SCHEMA_VERSION,
    siteKey: data.siteKey,
    browserId: data.browserId,
    configVersion: data.configVersion,
    categories: { ...data.categories },
    updatedAt: data.updatedAt,
    registered: data.registered === true,
    pendingSync: data.pendingSync === true,
  };
}

export class ConsentStorage {
  readonly key: string;

  constructor(
    private readonly siteKey: string,
    private backend: KeyValueBackend = detectBackend()
  ) {
    this.key = storageKey(siteKey);
  }

  get kind(): KeyValueBackend['kind'] {
    return this.backend.kind;
  }

  /** Reads the record; a corrupted or old-schema record is discarded. */
  read(): StoredConsent | null {
    let raw: string | null;
    try {
      raw = this.backend.get(this.key);
    } catch {
      return null;
    }
    const record = parseStoredConsent(raw, this.siteKey);
    if (raw !== null && !record) this.remove();
    return record;
  }

  write(record: Omit<StoredConsent, 'v' | 'siteKey'>): StoredConsent {
    const full: StoredConsent = { v: SCHEMA_VERSION, siteKey: this.siteKey, ...record };
    try {
      this.backend.set(this.key, JSON.stringify(full));
    } catch {
      // The backend stopped working (e.g. quota); keep the choice for this page.
      this.backend = memoryBackend();
      this.backend.set(this.key, JSON.stringify(full));
    }
    return full;
  }

  remove(): void {
    try {
      this.backend.remove(this.key);
    } catch {
      /* nothing to clean up */
    }
  }
}

export function createBrowserId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
