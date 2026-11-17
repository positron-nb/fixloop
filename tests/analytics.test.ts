import { describe, expect, it } from 'vitest';
import { campusAnalytics, median, percentile } from '../shared/analytics';
import { assetHistory, repeatFailureAssets } from '../shared/assetIntel';
import { buildDemoDataset } from '../shared/demo';
import { computePriority } from '../shared/priority';
import type { IssueRecord } from '../shared/types';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const h = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
const d = (daysAgo: number) => h(daysAgo * 24);

let seq = 0;
function issue(over: Partial<IssueRecord>): IssueRecord {
  const p = computePriority({ severity: 'MEDIUM', issueTypeWeight: 6, confirmations: 0, hoursWaiting: 0, assetCriticality: 1, reopenCount: 0 });
  return {
    id: `i${++seq}`,
    assetId: 'A1',
    assetName: 'Cooler',
    assetType: 'WATER_COOLER',
    building: 'Hostel 4',
    locationLabel: 'GF',
    issueType: 'NO_WATER',
    department: 'PLUMBING',
    severity: 'HIGH',
    status: 'OPEN',
    photoKeys: [],
    priorityScore: p.score,
    priorityBand: p.band,
    priorityBreakdown: p.breakdown,
    confirmationCount: 0,
    reopenCount: 0,
    escalationLevel: 0,
    assetCriticality: 1,
    reportedAt: h(10),
    lastOpenedAt: h(10),
    slaDueAt: h(-14),
    slaBreached: false,
    repairEvidenceKeys: [],
    isDemo: false,
    ...over,
  };
}

describe('statistics helpers', () => {
  it('median and percentile ignore non-finite values', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([NaN, NaN])).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 90)).toBeNull();
  });
});

describe('campus analytics', () => {
  const issues: IssueRecord[] = [
    // Closed + verified: ack 2h, resolved 10h after open, closed 12h after report, rating 5
    issue({ status: 'CLOSED', reportedAt: h(30), lastOpenedAt: h(30), acknowledgedAt: h(28), resolvedAt: h(20), closedAt: h(18), slaDueAt: h(6), verificationRating: 5, verificationComment: 'Great', confirmationCount: 2 }),
    // Auto-closed without verification
    issue({ status: 'CLOSED_UNVERIFIED', department: 'ELECTRICAL', reportedAt: h(200), lastOpenedAt: h(200), acknowledgedAt: h(196), resolvedAt: h(150), closedAt: h(78), slaDueAt: h(176) }),
    // Active, breached SLA
    issue({ status: 'OPEN', building: 'Library', reportedAt: h(40), lastOpenedAt: h(40), slaDueAt: h(16), priorityBand: 'P1', confirmationCount: 3 }),
    // Active, awaiting verification, reopened once before
    issue({ status: 'RESOLVED', reportedAt: h(50), lastOpenedAt: h(20), acknowledgedAt: h(49), resolvedAt: h(5), slaDueAt: h(-4), reopenCount: 1, priorityBand: 'P2' }),
    // Invalid: excluded from everything except the invalid counter
    issue({ status: 'INVALID', confirmationCount: 9 }),
  ];
  const a = campusAnalytics(issues, 12, NOW);

  it('totals, duplicates consolidated and status counts', () => {
    expect(a.totals).toMatchObject({ assets: 12, issues: 4, active: 2, awaitingVerification: 1, verifiedClosed: 1, closedUnverified: 1, invalid: 1 });
    expect(a.totals.duplicatesConsolidated).toBe(5); // 2 + 3, invalid excluded
    expect(a.totals.reports).toBe(9);
    expect(a.byStatus.OPEN).toBe(1);
  });

  it('verification rate counts only reporter-verified closures', () => {
    expect(a.verification.verificationRatePct).toBe(50);
    expect(a.verification.avgRating).toBe(5);
    expect(a.verification.reopenRatePct).toBe(33.3); // 1 of 3 issues that reached resolution
    expect(a.verification.recentComments[0].comment).toBe('Great');
  });

  it('timings use medians in hours', () => {
    expect(a.timing.medianAckHours).toBe(2); // [2, 4, 1] → 2
    expect(a.timing.medianResolveHours).toBe(15); // [10, 50, 15] → 15
    expect(a.timing.medianCloseHours).toBe(12);
  });

  it('SLA classification and department performance', () => {
    expect(a.sla.BREACHED).toBe(1);
    expect(a.sla.MET).toBe(2); // resolved before their due times
    expect(a.sla.MISSED).toBe(1);
    const plumbing = a.byDepartment.find((x) => x.department === 'PLUMBING')!;
    expect(plumbing.total).toBe(3);
    expect(plumbing.breachedNow).toBe(1);
    const electrical = a.byDepartment.find((x) => x.department === 'ELECTRICAL')!;
    expect(electrical.slaMetPct).toBe(0); // resolved after its due time
  });

  it('hotspots and buildings', () => {
    expect(a.byBuilding[0]).toEqual({ building: 'Hostel 4', count: 3, active: 1 });
    expect(a.hotspots.find((x) => x.building === 'Library')?.count).toBe(1);
    expect(a.priority.P1).toBe(1);
  });

  it('trend covers the requested window', () => {
    expect(a.trend).toHaveLength(14);
    expect(a.trend[13].day).toBe('2026-11-20');
  });
});

describe('asset intelligence (rules, not predictions)', () => {
  it('computes history, MTBF and preventive-maintenance recommendations', () => {
    const list = [
      issue({ assetId: 'WC', status: 'CLOSED', reportedAt: d(50), resolvedAt: d(49) }),
      issue({ assetId: 'WC', status: 'CLOSED', issueType: 'NOT_COOLING', reportedAt: d(30), resolvedAt: d(28) }),
      issue({ assetId: 'WC', status: 'CLOSED', reportedAt: d(14), resolvedAt: d(13), reopenCount: 2 }),
      issue({ assetId: 'WC', status: 'OPEN', issueType: 'LEAKING', reportedAt: d(1), confirmationCount: 3 }),
      issue({ assetId: 'WC', status: 'INVALID', reportedAt: d(2) }),
    ];
    const hist = assetHistory('WC', list, NOW);
    expect(hist.totalFaults).toBe(4);
    expect(hist.totalReports).toBe(7);
    expect(hist.verifiedRepairs).toBe(3);
    expect(hist.activeFaults).toBe(1);
    expect(hist.lastServiceAt).toBe(d(13));
    expect(hist.mtbfDays).toBe(16.3); // gaps 20, 16, 13
    expect(hist.recommendations.map((r) => r.code).sort()).toEqual(['FIX_NOT_HOLDING', 'RECURRING_SAME_FAULT', 'REPEAT_FAILURE']);
    expect(hist.healthScore).toBeLessThan(40);
  });

  it('a healthy asset has no recommendations', () => {
    const hist = assetHistory('X', [issue({ assetId: 'X', status: 'CLOSED', reportedAt: d(120), resolvedAt: d(119) })], NOW);
    expect(hist.recommendations).toEqual([]);
    expect(hist.mtbfDays).toBeNull();
    expect(hist.healthScore).toBe(100);
  });

  it('repeat-failure list surfaces the demo water cooler first', () => {
    const ds = buildDemoDataset(NOW);
    const list = repeatFailureAssets(ds.assets.map((x) => x.id), ds.issues, NOW);
    expect(list[0].assetId).toBe('DEMO-H4-WC-01');
    expect(list[0].recommendations.length).toBeGreaterThanOrEqual(2);
  });
});
