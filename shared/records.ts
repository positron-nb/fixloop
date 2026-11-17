/** Converts raw AppSync model records into domain records (arrays de-nulled, AWSJSON parsed). */
import type { AssetRecord, IssueEventRecord, IssueRecord } from './types';

export const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function parseJson<T = unknown>(v: unknown, fallback: T): T {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return (v ?? fallback) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toIssue(r: any): IssueRecord {
  return {
    ...r,
    photoKeys: strings(r.photoKeys),
    repairEvidenceKeys: strings(r.repairEvidenceKeys),
    priorityBreakdown: parseJson(r.priorityBreakdown, { severity: 0, issueType: 0, confirmations: 0, waiting: 0, assetCriticality: 0, reopened: 0 }),
  } as IssueRecord;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toAsset = (r: any): AssetRecord => ({ ...r, status: r.status ?? 'ACTIVE', isDemo: !!r.isDemo }) as AssetRecord;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toEvent = (r: any): IssueEventRecord & { id: string } => ({ ...r, evidenceKeys: strings(r.evidenceKeys) }) as IssueEventRecord & { id: string };
