/**
 * Campus analytics computed from issue records.
 * Pure functions: the admin dashboard and the tests use exactly the same code.
 */
import { DEPARTMENT_CODES, TRIAGE, type DepartmentCode } from './catalog';
import { slaState, type SlaState } from './priority';
import { ISSUE_STATUSES, isActive, type IssueRecord, type IssueStatus } from './types';

const HOUR = 3_600_000;

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

const hours = (from?: string | null, to?: string | null) =>
  from && to ? (new Date(to).getTime() - new Date(from).getTime()) / HOUR : NaN;

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const pct = (num: number, den: number) => (den ? Math.round((1000 * num) / den) / 10 : null);

export interface DepartmentStats {
  department: DepartmentCode | typeof TRIAGE;
  total: number;
  active: number;
  awaitingVerification: number;
  closed: number;
  medianAckHours: number | null;
  medianResolveHours: number | null;
  slaMetPct: number | null;
  breachedNow: number;
  reopenRatePct: number | null;
}

export interface CampusAnalytics {
  totals: {
    assets: number;
    issues: number;
    active: number;
    awaitingVerification: number;
    verifiedClosed: number;
    closedUnverified: number;
    invalid: number;
    reports: number;
    duplicatesConsolidated: number;
  };
  byStatus: Record<IssueStatus, number>;
  byDepartment: DepartmentStats[];
  byCategory: { issueType: string; assetType: string; count: number }[];
  byBuilding: { building: string; count: number; active: number }[];
  hotspots: { building: string; department: string; count: number }[];
  sla: Record<SlaState, number>;
  timing: {
    medianAckHours: number | null;
    medianResolveHours: number | null;
    p90ResolveHours: number | null;
    medianCloseHours: number | null;
    medianSubmitSeconds: number | null;
  };
  verification: {
    verificationRatePct: number | null; // verified / (verified + auto-closed unverified)
    reopenRatePct: number | null; // issues reopened at least once / issues that reached RESOLVED
    avgRating: number | null;
    ratings: number;
    recentComments: { issueId: string; comment: string; rating: number | null; at: string }[];
  };
  priority: Record<'P1' | 'P2' | 'P3' | 'P4', number>;
  trend: { day: string; reported: number; resolved: number }[];
}

export function campusAnalytics(issues: IssueRecord[], assetCount: number, now: Date, trendDays = 14): CampusAnalytics {
  const byStatus = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as Record<IssueStatus, number>;
  for (const i of issues) byStatus[i.status]++;

  const valid = issues.filter((i) => i.status !== 'INVALID');
  const active = valid.filter((i) => isActive(i.status));
  const confirmations = valid.reduce((a, i) => a + i.confirmationCount, 0);

  const ack = valid.map((i) => hours(i.reportedAt, i.acknowledgedAt));
  // Staff resolution time: from the start of the current cycle to its resolution.
  const resolve = valid.filter((i) => i.resolvedAt).map((i) => hours(i.lastOpenedAt, i.resolvedAt));
  const close = valid.filter((i) => i.status === 'CLOSED').map((i) => hours(i.reportedAt, i.closedAt));
  const submit = valid.map((i) => (i.submitMs ?? NaN) / 1000);

  const sla: Record<SlaState, number> = { ON_TRACK: 0, AT_RISK: 0, BREACHED: 0, MET: 0, MISSED: 0 };
  for (const i of valid) {
    if (i.status === 'INVALID') continue;
    sla[slaState({ reportedAt: i.lastOpenedAt, slaDueAt: i.slaDueAt, resolvedAt: i.resolvedAt, now })]++;
  }

  const departments: (DepartmentCode | typeof TRIAGE)[] = [...DEPARTMENT_CODES, TRIAGE];
  const byDepartment: DepartmentStats[] = departments.map((d) => {
    const list = valid.filter((i) => i.department === d);
    const reachedResolution = list.filter((i) => i.resolvedAt || i.reopenCount > 0 || i.status === 'CLOSED' || i.status === 'CLOSED_UNVERIFIED');
    const withSlaOutcome = list.filter((i) => i.resolvedAt);
    const met = withSlaOutcome.filter((i) => new Date(i.resolvedAt!).getTime() <= new Date(i.slaDueAt).getTime()).length;
    return {
      department: d,
      total: list.length,
      active: list.filter((i) => isActive(i.status)).length,
      awaitingVerification: list.filter((i) => i.status === 'RESOLVED').length,
      closed: list.filter((i) => i.status === 'CLOSED' || i.status === 'CLOSED_UNVERIFIED').length,
      medianAckHours: round1(median(list.map((i) => hours(i.reportedAt, i.acknowledgedAt)))),
      medianResolveHours: round1(median(list.filter((i) => i.resolvedAt).map((i) => hours(i.lastOpenedAt, i.resolvedAt)))),
      slaMetPct: pct(met, withSlaOutcome.length),
      breachedNow: list.filter((i) => !i.resolvedAt && isActive(i.status) && now.getTime() > new Date(i.slaDueAt).getTime()).length,
      reopenRatePct: pct(reachedResolution.filter((i) => i.reopenCount > 0).length, reachedResolution.length),
    };
  });

  const catMap = new Map<string, { issueType: string; assetType: string; count: number }>();
  for (const i of valid) {
    const k = `${i.assetType}/${i.issueType}`;
    const e = catMap.get(k) ?? { issueType: i.issueType, assetType: i.assetType, count: 0 };
    e.count++;
    catMap.set(k, e);
  }

  const bMap = new Map<string, { building: string; count: number; active: number }>();
  const hMap = new Map<string, { building: string; department: string; count: number }>();
  for (const i of valid) {
    const b = bMap.get(i.building) ?? { building: i.building, count: 0, active: 0 };
    b.count++;
    if (isActive(i.status)) b.active++;
    bMap.set(i.building, b);
    const hk = `${i.building}|${i.department}`;
    const h = hMap.get(hk) ?? { building: i.building, department: i.department, count: 0 };
    h.count++;
    hMap.set(hk, h);
  }

  const verified = byStatus.CLOSED;
  const unverified = byStatus.CLOSED_UNVERIFIED;
  const reachedResolution = valid.filter((i) => i.resolvedAt || i.reopenCount > 0 || i.status === 'CLOSED' || i.status === 'CLOSED_UNVERIFIED');
  const rated = valid.filter((i) => typeof i.verificationRating === 'number');

  const priority = { P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const i of active) priority[i.priorityBand]++;

  const trend: CampusAnalytics['trend'] = [];
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  for (let k = trendDays - 1; k >= 0; k--) {
    const day = dayKey(new Date(now.getTime() - k * 86_400_000));
    trend.push({
      day,
      reported: valid.filter((i) => i.reportedAt.slice(0, 10) === day).length,
      resolved: valid.filter((i) => (i.resolvedAt ?? '').slice(0, 10) === day).length,
    });
  }

  return {
    totals: {
      assets: assetCount,
      issues: valid.length,
      active: active.length,
      awaitingVerification: byStatus.RESOLVED,
      verifiedClosed: verified,
      closedUnverified: unverified,
      invalid: byStatus.INVALID,
      reports: valid.length + confirmations,
      duplicatesConsolidated: confirmations,
    },
    byStatus,
    byDepartment,
    byCategory: [...catMap.values()].sort((a, b) => b.count - a.count),
    byBuilding: [...bMap.values()].sort((a, b) => b.count - a.count),
    hotspots: [...hMap.values()],
    sla,
    timing: {
      medianAckHours: round1(median(ack)),
      medianResolveHours: round1(median(resolve)),
      p90ResolveHours: round1(percentile(resolve, 90)),
      medianCloseHours: round1(median(close)),
      medianSubmitSeconds: round1(median(submit)),
    },
    verification: {
      verificationRatePct: pct(verified, verified + unverified),
      reopenRatePct: pct(reachedResolution.filter((i) => i.reopenCount > 0).length, reachedResolution.length),
      avgRating: rated.length ? Math.round((10 * rated.reduce((a, i) => a + (i.verificationRating ?? 0), 0)) / rated.length) / 10 : null,
      ratings: rated.length,
      recentComments: valid
        .filter((i) => i.verificationComment && i.closedAt)
        .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
        .slice(0, 5)
        .map((i) => ({ issueId: i.id, comment: i.verificationComment!, rating: i.verificationRating ?? null, at: i.closedAt! })),
    },
    priority,
    trend,
  };
}
