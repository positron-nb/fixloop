import { describe, expect, it } from 'vitest';
import {
  bandFor,
  computePriority,
  confirmationPoints,
  effectiveSeverity,
  slaDueAt,
  slaState,
  waitingPoints,
} from '../shared/priority';

describe('priority score (transparent, rule-based)', () => {
  const base = { severity: 'MEDIUM' as const, issueTypeWeight: 6, confirmations: 0, hoursWaiting: 0, assetCriticality: 1, reopenCount: 0 };

  it('sums documented components exactly', () => {
    const p = computePriority({ severity: 'HIGH', issueTypeWeight: 10, confirmations: 3, hoursWaiting: 12, assetCriticality: 3, reopenCount: 1 });
    // HIGH 25 + type 10 + conf round(6*log2(4))=12 + wait round(20*12/24)=10 + crit 12 + reopen 5 = 74
    expect(p.breakdown).toEqual({ severity: 25, issueType: 10, confirmations: 12, waiting: 10, assetCriticality: 12, reopened: 5 });
    expect(p.score).toBe(74);
    expect(p.band).toBe('P1');
  });

  it('ranks a safety hazard above a cosmetic fault with many confirmations', () => {
    const hazard = computePriority({ ...base, severity: 'CRITICAL', issueTypeWeight: 15 });
    const cosmetic = computePriority({ ...base, severity: 'LOW', issueTypeWeight: 3, confirmations: 10 });
    expect(hazard.score).toBeGreaterThan(cosmetic.score);
  });

  it('more independent confirmations raise priority, with diminishing returns and a cap', () => {
    expect(confirmationPoints(0)).toBe(0);
    expect(confirmationPoints(1)).toBe(6);
    expect(confirmationPoints(3)).toBe(12);
    expect(confirmationPoints(7)).toBe(18);
    expect(confirmationPoints(1000)).toBe(20);
    expect(confirmationPoints(-5)).toBe(0);
  });

  it('waiting time scales against the severity SLA and caps at 20', () => {
    expect(waitingPoints(2, 'CRITICAL')).toBe(10); // half of a 4h SLA
    expect(waitingPoints(2, 'LOW')).toBe(0); // 2h of 168h
    expect(waitingPoints(500, 'LOW')).toBe(20);
    expect(waitingPoints(Number.NaN, 'HIGH')).toBe(0);
  });

  it('clamps out-of-range inputs and never exceeds 100', () => {
    const p = computePriority({ severity: 'CRITICAL', issueTypeWeight: 99, confirmations: 99, hoursWaiting: 9999, assetCriticality: 9, reopenCount: 9 });
    expect(p.breakdown.issueType).toBe(15);
    expect(p.breakdown.assetCriticality).toBe(12);
    expect(p.breakdown.reopened).toBe(10);
    expect(p.score).toBe(100);
    expect(computePriority({ ...base, assetCriticality: 0 }).breakdown.assetCriticality).toBe(0);
  });

  it('band thresholds', () => {
    expect(bandFor(70)).toBe('P1');
    expect(bandFor(69)).toBe('P2');
    expect(bandFor(45)).toBe('P2');
    expect(bandFor(44)).toBe('P3');
    expect(bandFor(25)).toBe('P3');
    expect(bandFor(24)).toBe('P4');
  });

  it('a reporter can raise only safety-relevant issues to CRITICAL, never lower severity', () => {
    expect(effectiveSeverity('MEDIUM', true, true)).toBe('CRITICAL');
    expect(effectiveSeverity('MEDIUM', true, false)).toBe('MEDIUM');
    expect(effectiveSeverity('HIGH', false, true)).toBe('HIGH');
  });
});

describe('SLA', () => {
  const reportedAt = '2026-11-20T09:00:00.000Z';
  const due = slaDueAt(reportedAt, 'HIGH'); // 24h

  it('due time follows severity', () => {
    expect(due).toBe('2026-11-21T09:00:00.000Z');
    expect(slaDueAt(reportedAt, 'CRITICAL')).toBe('2026-11-20T13:00:00.000Z');
  });

  it('classifies on-track, at-risk, breached, met and missed', () => {
    const at = (h: number) => new Date(new Date(reportedAt).getTime() + h * 3_600_000);
    expect(slaState({ reportedAt, slaDueAt: due, now: at(1) })).toBe('ON_TRACK');
    expect(slaState({ reportedAt, slaDueAt: due, now: at(20) })).toBe('AT_RISK');
    expect(slaState({ reportedAt, slaDueAt: due, now: at(25) })).toBe('BREACHED');
    expect(slaState({ reportedAt, slaDueAt: due, resolvedAt: at(23).toISOString(), now: at(40) })).toBe('MET');
    expect(slaState({ reportedAt, slaDueAt: due, resolvedAt: at(26).toISOString(), now: at(40) })).toBe('MISSED');
  });
});
