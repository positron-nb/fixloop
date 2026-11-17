import type { RoutingDepartment, Severity } from './catalog';
import type { PriorityBand, PriorityBreakdown } from './priority';

export const ISSUE_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'CLOSED_UNVERIFIED',
  'INVALID',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Statuses in which the fault still exists (or the fix is not yet verified). */
export const ACTIVE_STATUSES: readonly IssueStatus[] = ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'];
/** Statuses in which the issue is waiting for maintenance work. */
export const AWAITING_WORK_STATUSES: readonly IssueStatus[] = ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'];
export const TERMINAL_STATUSES: readonly IssueStatus[] = ['CLOSED', 'CLOSED_UNVERIFIED', 'INVALID'];

export const isActive = (s: IssueStatus) => ACTIVE_STATUSES.includes(s);
export const isAwaitingWork = (s: IssueStatus) => AWAITING_WORK_STATUSES.includes(s);

export interface AssetRecord {
  id: string; // human-readable asset code, also printed on the QR label, e.g. "H4-WC-01"
  name: string;
  nameHi?: string | null;
  assetType: string;
  building: string;
  floor?: string | null;
  locationLabel: string;
  locationLabelHi?: string | null;
  criticality: number; // 1–3
  status: 'ACTIVE' | 'RETIRED';
  installedOn?: string | null;
  isDemo: boolean;
}

export interface IssueRecord {
  id: string;
  assetId: string;
  assetName: string;
  assetType: string;
  building: string;
  locationLabel: string;
  issueType: string;
  department: RoutingDepartment;
  severity: Severity;
  status: IssueStatus;
  description?: string | null;
  photoKeys: string[];
  priorityScore: number;
  priorityBand: PriorityBand;
  priorityBreakdown: PriorityBreakdown;
  confirmationCount: number;
  reopenCount: number;
  escalationLevel: number;
  assetCriticality: number;
  reportedAt: string;
  lastOpenedAt: string;
  acknowledgedAt?: string | null;
  startedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaDueAt: string;
  slaBreached: boolean;
  assigneeSub?: string | null;
  assigneeName?: string | null;
  resolutionRemarks?: string | null;
  repairEvidenceKeys: string[];
  verificationOutcome?: 'FIXED' | 'NOT_FIXED' | null;
  verificationRating?: number | null;
  verificationComment?: string | null;
  declineReason?: string | null;
  invalidReason?: string | null;
  submitMs?: number | null;
  isDemo: boolean;
}

export type ReportKind = 'ORIGINAL' | 'CONFIRMATION';

export interface ReportRecord {
  id: string; // `${issueId}#${reporterSub}`: one report per person per issue
  issueId: string;
  assetId: string;
  reporterSub: string;
  kind: ReportKind;
  note?: string | null;
  photoKeys: string[];
  submitMs?: number | null;
  createdAt: string;
  verification?: 'FIXED' | 'NOT_FIXED' | null;
  verifiedAt?: string | null;
  isDemo: boolean;
}

export type EventType =
  | 'REPORTED'
  | 'CONFIRMED'
  | 'ACCEPT'
  | 'DECLINE'
  | 'START'
  | 'RESOLVE'
  | 'VERIFY_FIXED'
  | 'VERIFY_NOT_FIXED'
  | 'REASSIGN'
  | 'MARK_INVALID'
  | 'AUTO_CLOSE'
  | 'ESCALATED';

export type ActorRole = 'STUDENT' | 'STAFF' | 'ADMIN' | 'SYSTEM';

export interface IssueEventRecord {
  issueId: string;
  type: EventType;
  fromStatus?: IssueStatus | null;
  toStatus?: IssueStatus | null;
  actorRole: ActorRole;
  /** Staff/admin display name. Always null for students: reporter identity is never exposed. */
  actorName?: string | null;
  note?: string | null;
  evidenceKeys: string[];
  at: string;
  isDemo: boolean;
}

/** Caller identity as resolved from the Cognito token by AppSync. */
export interface Actor {
  sub: string;
  username: string;
  groups: string[];
  displayName?: string;
}
