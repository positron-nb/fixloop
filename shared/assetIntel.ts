/**
 * Asset intelligence: per-asset maintenance memory with transparent preventive-maintenance rules.
 *
 * This is NOT predictive AI. These are historical analytics and explicit rules whose
 * thresholds are listed below and shown in the UI. With more data, rules can be tuned;
 * we make no accuracy claims.
 */
import { isActive, type IssueRecord } from './types';

export const RULES = {
  REPEAT_FAILURE: { windowDays: 90, minFaults: 3 },
  RECURRING_SAME_FAULT: { windowDays: 60, minSameType: 2 },
  FIX_NOT_HOLDING: { minReopens: 2 },
  SHORT_INTERVAL: { maxMtbfDays: 14, minFaults: 3 },
} as const;

export type RecommendationCode = keyof typeof RULES;

export interface Recommendation {
  code: RecommendationCode;
  severity: 'warning' | 'critical';
  /** Facts that triggered the rule, for display. */
  evidence: Record<string, string | number>;
}

export interface AssetHistory {
  assetId: string;
  totalFaults: number;
  totalReports: number; // faults + independent confirmations
  verifiedRepairs: number;
  unverifiedClosures: number;
  activeFaults: number;
  reopenTotal: number;
  lastServiceAt: string | null;
  lastReportedAt: string | null;
  /** Mean days between consecutive fault reports (needs ≥ 2 faults). */
  mtbfDays: number | null;
  faultsInLast90Days: number;
  topIssueType: { code: string; count: number } | null;
  recommendations: Recommendation[];
  /** 0–100: 100 = no faults recently. Simple, explainable. */
  healthScore: number;
}

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function assetHistory(assetId: string, issues: IssueRecord[], now: Date): AssetHistory {
  const faults = issues.filter((i) => i.assetId === assetId && i.status !== 'INVALID');
  const sorted = [...faults].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
  const t = now.getTime();

  const gaps: number[] = [];
  for (let k = 1; k < sorted.length; k++) {
    gaps.push((new Date(sorted[k].reportedAt).getTime() - new Date(sorted[k - 1].reportedAt).getTime()) / DAY);
  }
  const mtbfDays = gaps.length ? round1(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  const within = (days: number) => sorted.filter((i) => t - new Date(i.reportedAt).getTime() <= days * DAY);
  const last90 = within(RULES.REPEAT_FAILURE.windowDays);
  const last60 = within(RULES.RECURRING_SAME_FAULT.windowDays);

  const typeCounts = new Map<string, number>();
  for (const i of sorted) typeCounts.set(i.issueType, (typeCounts.get(i.issueType) ?? 0) + 1);
  let topIssueType: AssetHistory['topIssueType'] = null;
  for (const [code, count] of typeCounts) if (!topIssueType || count > topIssueType.count) topIssueType = { code, count };

  const resolvedTimes = sorted.map((i) => i.resolvedAt).filter((x): x is string => !!x).sort();
  const reopenTotal = sorted.reduce((a, i) => a + i.reopenCount, 0);

  const recs: Recommendation[] = [];
  if (last90.length >= RULES.REPEAT_FAILURE.minFaults) {
    recs.push({ code: 'REPEAT_FAILURE', severity: last90.length >= 5 ? 'critical' : 'warning', evidence: { faults: last90.length, days: RULES.REPEAT_FAILURE.windowDays } });
  }
  const sameType = new Map<string, number>();
  for (const i of last60) sameType.set(i.issueType, (sameType.get(i.issueType) ?? 0) + 1);
  for (const [code, count] of sameType) {
    if (count >= RULES.RECURRING_SAME_FAULT.minSameType) {
      recs.push({ code: 'RECURRING_SAME_FAULT', severity: 'warning', evidence: { issueType: code, count, days: RULES.RECURRING_SAME_FAULT.windowDays } });
    }
  }
  if (reopenTotal >= RULES.FIX_NOT_HOLDING.minReopens) {
    recs.push({ code: 'FIX_NOT_HOLDING', severity: 'critical', evidence: { reopens: reopenTotal } });
  }
  if (mtbfDays !== null && sorted.length >= RULES.SHORT_INTERVAL.minFaults && mtbfDays <= RULES.SHORT_INTERVAL.maxMtbfDays) {
    recs.push({ code: 'SHORT_INTERVAL', severity: 'critical', evidence: { mtbfDays } });
  }

  const activeFaults = sorted.filter((i) => isActive(i.status)).length;
  // Health: start at 100, −12 per fault in 90 days, −15 per active fault, −10 per reopen; clamp 0–100.
  const healthScore = Math.max(0, Math.min(100, 100 - 12 * last90.length - 15 * activeFaults - 10 * reopenTotal));

  return {
    assetId,
    totalFaults: sorted.length,
    totalReports: sorted.length + sorted.reduce((a, i) => a + i.confirmationCount, 0),
    verifiedRepairs: sorted.filter((i) => i.status === 'CLOSED').length,
    unverifiedClosures: sorted.filter((i) => i.status === 'CLOSED_UNVERIFIED').length,
    activeFaults,
    reopenTotal,
    lastServiceAt: resolvedTimes.length ? resolvedTimes[resolvedTimes.length - 1] : null,
    lastReportedAt: sorted.length ? sorted[sorted.length - 1].reportedAt : null,
    mtbfDays,
    faultsInLast90Days: last90.length,
    topIssueType,
    recommendations: recs,
    healthScore,
  };
}

/** Assets with at least one recommendation, worst first. */
export function repeatFailureAssets(assetIds: string[], issues: IssueRecord[], now: Date): AssetHistory[] {
  const byAsset = new Map<string, IssueRecord[]>();
  for (const i of issues) {
    const list = byAsset.get(i.assetId) ?? [];
    list.push(i);
    byAsset.set(i.assetId, list);
  }
  return assetIds
    .map((id) => assetHistory(id, byAsset.get(id) ?? [], now))
    .filter((h) => h.recommendations.length > 0)
    .sort((a, b) => a.healthScore - b.healthScore || b.totalFaults - a.totalFaults);
}
