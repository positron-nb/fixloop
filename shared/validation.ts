import { DomainError } from './errors';

/** Asset codes printed on QR labels: 3–24 chars of A–Z, 0–9 and dashes, e.g. "H4-WC-01". */
export const ASSET_CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$/;

export function normaliseAssetCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export function assertAssetCode(code: string): string {
  const c = normaliseAssetCode(code);
  if (!ASSET_CODE_RE.test(c)) throw new DomainError('VALIDATION', 'Asset code must be 3–24 letters, digits or dashes');
  return c;
}

/**
 * Extracts an asset code from a scanned QR payload. Accepts full URLs (…/a/H4-WC-01)
 * or a bare code. Returns null for anything else, so scanned text is never trusted blindly.
 */
export function assetCodeFromScan(payload: string): string | null {
  const raw = payload.trim();
  const fromUrl = /\/a\/([A-Za-z0-9-]{3,24})(?:[/?#]|$)/.exec(raw);
  const candidate = normaliseAssetCode(fromUrl ? fromUrl[1] : raw);
  return ASSET_CODE_RE.test(candidate) ? candidate : null;
}

// Cognito identity IDs look like "ap-south-1:1b2c…"; file names are generated client-side.
const IDENTITY = '[a-z]{2}(?:-[a-z]+)+-\\d:[0-9a-f-]{36}';
const FILE = '[A-Za-z0-9][A-Za-z0-9._-]{0,99}';
export const REPORT_PHOTO_KEY_RE = new RegExp(`^reports/${IDENTITY}/${FILE}$`);
export const REPAIR_PHOTO_KEY_RE = new RegExp(`^repairs/${FILE}$`);

export function assertPhotoKeys(keys: unknown, kind: 'report' | 'repair', max = 3): string[] {
  if (keys == null) return [];
  if (!Array.isArray(keys)) throw new DomainError('VALIDATION', 'Photos must be a list');
  if (keys.length > max) throw new DomainError('VALIDATION', `At most ${max} photos`);
  const re = kind === 'report' ? REPORT_PHOTO_KEY_RE : REPAIR_PHOTO_KEY_RE;
  for (const k of keys) {
    if (typeof k !== 'string' || !re.test(k)) throw new DomainError('VALIDATION', 'Invalid photo reference');
  }
  return [...new Set(keys as string[])];
}

export function cleanText(v: unknown, max: number, field: string): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw new DomainError('VALIDATION', `${field} must be text`);
  // Strip control characters (keep newlines/tabs); normalise whitespace runs.
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (t.length > max) throw new DomainError('VALIDATION', `${field} must be at most ${max} characters`);
  return t || null;
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
