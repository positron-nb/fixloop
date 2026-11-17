/**
 * Transparent, rule-based priority score (0–100).
 *
 * No machine learning. Every point is explainable, and the breakdown is stored
 * on the issue and shown in the UI ("Why is this P1?").
 *
 *   severity        CRITICAL 40 · HIGH 25 · MEDIUM 12 · LOW 4
 *   issue type      0–15  (catalog weight)
 *   confirmations   min(20, round(6 × log2(1 + n)))   n = independent confirmations
 *   waiting time    min(20, round(20 × hoursWaiting / slaHours))
 *   asset criticality (criticality − 1) × 6 → 0 / 6 / 12
 *   reopened        min(10, 5 × reopenCount)
 *
 *   total = min(100, sum)   →   P1 ≥ 70 · P2 ≥ 45 · P3 ≥ 25 · P4 otherwise
 */
import { SLA_HOURS, type Severity } from './catalog';

export const SEVERITY_POINTS: Record<Severity, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 12,
  LOW: 4,
};

export type PriorityBand = 'P1' | 'P2' | 'P3' | 'P4';

export interface PriorityInput {
  severity: Severity;
  issueTypeWeight: number;
  confirmations: number;
  /** Hours since the issue was (re)opened and still waiting for a fix. */
  hoursWaiting: number;
  /** 1 = normal, 2 = important, 3 = only source / safety-critical. */
  assetCriticality: number;
  reopenCount: number;
}

export interface PriorityBreakdown {
  severity: number;
  issueType: number;
  confirmations: number;
  waiting: number;
  assetCriticality: number;
  reopened: number;
}

export interface PriorityResult {
  score: number;
  band: PriorityBand;
  breakdown: PriorityBreakdown;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function confirmationPoints(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(20, Math.round(6 * Math.log2(1 + n)));
}

export function waitingPoints(hoursWaiting: number, severity: Severity): number {
  if (!Number.isFinite(hoursWaiting) || hoursWaiting <= 0) return 0;
  return Math.min(20, Math.round((20 * hoursWaiting) / SLA_HOURS[severity]));
}

export function bandFor(score: number): PriorityBand {
  if (score >= 70) return 'P1';
  if (score >= 45) return 'P2';
  if (score >= 25) return 'P3';
  return 'P4';
}

export function computePriority(input: PriorityInput): PriorityResult {
  const breakdown: PriorityBreakdown = {
    severity: SEVERITY_POINTS[input.severity],
    issueType: clamp(Math.round(input.issueTypeWeight), 0, 15),
    confirmations: confirmationPoints(input.confirmations),
    waiting: waitingPoints(input.hoursWaiting, input.severity),
    assetCriticality: (clamp(Math.round(input.assetCriticality), 1, 3) - 1) * 6,
    reopened: Math.min(10, 5 * Math.max(0, Math.round(input.reopenCount))),
  };
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.min(100, sum);
  return { score, band: bandFor(score), breakdown };
}

/** Effective severity: a reporter can raise a safety-relevant issue to CRITICAL, never lower it. */
export function effectiveSeverity(defaultSeverity: Severity, safetyFlag: boolean, safetyRelevant: boolean): Severity {
  if (safetyFlag && safetyRelevant) return 'CRITICAL';
  return defaultSeverity;
}

export function slaDueAt(fromIso: string, severity: Severity): string {
  return new Date(new Date(fromIso).getTime() + SLA_HOURS[severity] * 3_600_000).toISOString();
}

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET' | 'MISSED';

/**
 * SLA is measured from report to staff resolution (RESOLVED), not to student verification,
 * so staff are not penalised for slow verifiers.
 */
export function slaState(params: {
  reportedAt: string;
  slaDueAt: string;
  resolvedAt?: string | null;
  now: Date;
}): SlaState {
  const due = new Date(params.slaDueAt).getTime();
  if (params.resolvedAt) {
    return new Date(params.resolvedAt).getTime() <= due ? 'MET' : 'MISSED';
  }
  const now = params.now.getTime();
  if (now > due) return 'BREACHED';
  const start = new Date(params.reportedAt).getTime();
  const elapsed = (now - start) / Math.max(1, due - start);
  return elapsed >= 0.75 ? 'AT_RISK' : 'ON_TRACK';
}
