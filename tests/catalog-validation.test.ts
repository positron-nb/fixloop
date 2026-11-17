import { describe, expect, it } from 'vitest';
import { ASSET_TYPES, DEPARTMENTS, DEPARTMENT_CODES, getIssueType } from '../shared/catalog';
import { buildDemoDataset } from '../shared/demo';
import { decodeError, encodeError, DomainError } from '../shared/errors';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from '../shared/types';
import { assertAssetCode, assertPhotoKeys, assetCodeFromScan, cleanText } from '../shared/validation';

const DEVANAGARI = /[ऀ-ॿ]/;

describe('catalog integrity', () => {
  it('every issue type routes to a real department and has a weight within 0–15', () => {
    for (const t of ASSET_TYPES) {
      for (const i of t.issueTypes) {
        expect(DEPARTMENT_CODES).toContain(i.department);
        expect(i.weight).toBeGreaterThanOrEqual(0);
        expect(i.weight).toBeLessThanOrEqual(15);
      }
    }
  });

  it('issue type codes are unique within an asset type and every asset type offers "Something else"', () => {
    for (const t of ASSET_TYPES) {
      const codes = t.issueTypes.map((i) => i.code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(getIssueType(t.code, 'OTHER')?.freeform).toBe(true);
    }
  });

  it('every label has English and Hindi (Devanagari) text', () => {
    const labels = [
      ...Object.values(DEPARTMENTS).map((d) => d.label),
      ...ASSET_TYPES.map((t) => t.label),
      ...ASSET_TYPES.flatMap((t) => t.issueTypes.map((i) => i.label)),
    ];
    for (const l of labels) {
      expect(l.en.length).toBeGreaterThan(1);
      expect(l.hi).toMatch(DEVANAGARI);
    }
  });

  it('safety-critical faults default to CRITICAL', () => {
    expect(getIssueType('WATER_COOLER', 'ELECTRIC_SHOCK')?.defaultSeverity).toBe('CRITICAL');
    expect(getIssueType('LIGHT', 'EXPOSED_WIRING')?.defaultSeverity).toBe('CRITICAL');
  });

  it('active and terminal statuses do not overlap', () => {
    expect(ACTIVE_STATUSES.filter((s) => TERMINAL_STATUSES.includes(s))).toEqual([]);
  });
});

describe('QR payload and input validation', () => {
  it('extracts asset codes from FixLoop URLs or bare codes, and rejects anything else', () => {
    expect(assetCodeFromScan('https://main.d1abc.amplifyapp.com/a/H4-WC-01')).toBe('H4-WC-01');
    expect(assetCodeFromScan('https://example.org/a/h4-wc-01?src=qr')).toBe('H4-WC-01');
    expect(assetCodeFromScan('  h4-wc-01 ')).toBe('H4-WC-01');
    expect(assetCodeFromScan('javascript:alert(1)')).toBeNull();
    expect(assetCodeFromScan('https://evil.example/login')).toBeNull();
    expect(assetCodeFromScan('')).toBeNull();
  });

  it('asset codes are 3–24 safe characters', () => {
    expect(assertAssetCode('lib wc 01')).toBe('LIB-WC-01');
    expect(() => assertAssetCode('a')).toThrow(DomainError);
    expect(() => assertAssetCode('X'.repeat(30))).toThrow(DomainError);
    expect(() => assertAssetCode('<script>')).toThrow(DomainError);
  });

  it('photo keys must stay inside the expected folders (no path traversal, max 3)', () => {
    const ok = 'reports/ap-south-1:0b1c2d3e-1111-2222-3333-444455556666/1700000000-a1.jpg';
    expect(assertPhotoKeys([ok, ok], 'report')).toEqual([ok]); // de-duplicated
    expect(() => assertPhotoKeys(['reports/../repairs/x.jpg'], 'report')).toThrow(DomainError);
    expect(() => assertPhotoKeys(['repairs/x.jpg'], 'report')).toThrow(DomainError);
    expect(() => assertPhotoKeys([ok], 'repair')).toThrow(DomainError);
    expect(() => assertPhotoKeys(['repairs/a.jpg', 'repairs/b.jpg', 'repairs/c.jpg', 'repairs/d.jpg'], 'repair')).toThrow(DomainError);
    expect(assertPhotoKeys(null, 'repair')).toEqual([]);
  });

  it('cleans control characters and enforces length', () => {
    expect(cleanText('  hello\u0000 world  ', 50, 'x')).toBe('hello world');
    expect(cleanText('   ', 50, 'x')).toBeNull();
    expect(() => cleanText('x'.repeat(51), 50, 'x')).toThrow(DomainError);
    expect(() => cleanText(42, 50, 'x')).toThrow(DomainError);
  });

  it('error codes round-trip through GraphQL error messages', () => {
    expect(decodeError(encodeError(new DomainError('FORBIDDEN', 'Only staff')))).toEqual({ code: 'FORBIDDEN', message: 'Only staff' });
    expect(decodeError('Network failure')).toEqual({ code: 'INTERNAL', message: 'Network failure' });
  });
});

describe('demo dataset labelling', () => {
  const ds = buildDemoDataset(new Date('2026-11-20T12:00:00.000Z'));
  it('every demo record is flagged and every demo asset code starts with DEMO-', () => {
    expect(ds.assets.every((a) => a.isDemo && a.id.startsWith('DEMO-'))).toBe(true);
    expect(ds.issues.every((i) => i.isDemo && i.assetId.startsWith('DEMO-'))).toBe(true);
    expect(ds.reports.every((r) => r.isDemo)).toBe(true);
    expect(ds.events.every((e) => e.isDemo)).toBe(true);
  });
  it('demo issues are internally consistent', () => {
    for (const i of ds.issues) {
      if (i.status === 'CLOSED') expect(i.verificationOutcome).toBe('FIXED');
      if (['CLOSED', 'CLOSED_UNVERIFIED', 'INVALID'].includes(i.status)) expect(i.closedAt).toBeTruthy();
      if (i.status === 'RESOLVED' || i.status === 'CLOSED') expect(i.resolvedAt).toBeTruthy();
      expect(ds.reports.filter((r) => r.issueId === i.id && r.kind === 'CONFIRMATION')).toHaveLength(i.confirmationCount);
      expect(new Set(ds.reports.filter((r) => r.issueId === i.id).map((r) => r.reporterSub)).size).toBe(i.confirmationCount + 1);
    }
  });
});
