/**
 * Issue lifecycle state machine with role-based permissions.
 *
 *   OPEN ──ACCEPT──▶ ACKNOWLEDGED ──START──▶ IN_PROGRESS ──RESOLVE──▶ RESOLVED ──VERIFY_FIXED──▶ CLOSED
 *    ▲  │                  │                                  ▲            │ └─(72h, no answer)──▶ CLOSED_UNVERIFIED
 *    │  └─DECLINE─▶ (TRIAGE)└──────────────RESOLVE─────────────┘            │
 *    │                                                                     └─VERIFY_NOT_FIXED──▶ REOPENED ──ACCEPT──▶ …
 *    └──────────────────────────── REASSIGN (admin) ──────────────────────────
 *   any active ──MARK_INVALID (admin)──▶ INVALID
 *
 * Staff can never close an issue. Only a reporter (original or confirmer) can close it,
 * or the system can, after the verification window, as CLOSED_UNVERIFIED (tracked separately).
 */
import {
  DEPARTMENTS,
  SLA_HOURS,
  TRIAGE,
  VERIFICATION_WINDOW_HOURS,
  isDepartmentCode,
  type DepartmentCode,
  type IssueType,
} from './catalog';
import { DomainError } from './errors';
import { computePriority, slaDueAt } from './priority';
import {
  isActive,
  isAwaitingWork,
  type Actor,
  type ActorRole,
  type EventType,
  type IssueRecord,
  type IssueStatus,
} from './types';

export type IssueAction =
  | 'ACCEPT'
  | 'DECLINE'
  | 'START'
  | 'RESOLVE'
  | 'VERIFY_FIXED'
  | 'VERIFY_NOT_FIXED'
  | 'REASSIGN'
  | 'MARK_INVALID'
  | 'AUTO_CLOSE';

export const STAFF_ACTIONS: IssueAction[] = ['ACCEPT', 'DECLINE', 'START', 'RESOLVE'];
export const REPORTER_ACTIONS: IssueAction[] = ['VERIFY_FIXED', 'VERIFY_NOT_FIXED'];
export const ADMIN_ACTIONS: IssueAction[] = ['REASSIGN', 'MARK_INVALID'];

export interface ActionPayload {
  note?: string | null;
  evidenceKeys?: string[];
  department?: string | null;
  rating?: number | null;
}

export interface TransitionContext {
  issue: IssueRecord;
  action: IssueAction;
  actor: Actor | 'SYSTEM';
  payload: ActionPayload;
  /** True if the actor filed or confirmed this issue. */
  isLinkedReporter: boolean;
  issueType: IssueType;
  now: Date;
}

export interface TransitionPlan {
  patch: Partial<IssueRecord>;
  toStatus: IssueStatus;
  event: { type: EventType; actorRole: ActorRole; note?: string | null; evidenceKeys: string[] };
}

export const hasGroup = (actor: Actor, group: string) => actor.groups.includes(group);
export const isAdmin = (actor: Actor) => hasGroup(actor, 'ADMIN');
export const isStaff = (actor: Actor) => hasGroup(actor, 'STAFF');

export function staffDepartments(actor: Actor): DepartmentCode[] {
  if (!isStaff(actor)) return [];
  return (Object.keys(DEPARTMENTS) as DepartmentCode[]).filter((d) => hasGroup(actor, DEPARTMENTS[d].group));
}

export function canActForDepartment(actor: Actor, department: string): boolean {
  return isDepartmentCode(department) && staffDepartments(actor).includes(department);
}

const text = (v: string | null | undefined) => (v ?? '').trim();

function requireNote(note: string | null | undefined, min: number, max: number, what: string): string {
  const t = text(note);
  if (t.length < min) throw new DomainError('VALIDATION', `${what} must be at least ${min} characters`);
  if (t.length > max) throw new DomainError('VALIDATION', `${what} must be at most ${max} characters`);
  return t;
}

function optionalNote(note: string | null | undefined, max: number): string | null {
  const t = text(note);
  if (t.length > max) throw new DomainError('VALIDATION', `Comment must be at most ${max} characters`);
  return t || null;
}

function requireStatus(issue: IssueRecord, allowed: IssueStatus[], action: IssueAction) {
  if (!allowed.includes(issue.status)) {
    throw new DomainError('INVALID_STATE', `Cannot ${action.toLowerCase().replace('_', ' ')} an issue that is ${issue.status}`);
  }
}

const iso = (d: Date) => d.toISOString();
const hoursBetween = (fromIso: string, to: Date) => Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / 3_600_000);

/** Recompute priority for the issue's current state. Waiting time counts only while work is pending. */
export function reprioritise(issue: IssueRecord, issueType: IssueType, now: Date): Pick<IssueRecord, 'priorityScore' | 'priorityBand' | 'priorityBreakdown'> {
  const hoursWaiting = isAwaitingWork(issue.status) ? hoursBetween(issue.lastOpenedAt, now) : 0;
  const p = computePriority({
    severity: issue.severity,
    issueTypeWeight: issueType.weight,
    confirmations: issue.confirmationCount,
    hoursWaiting,
    assetCriticality: issue.assetCriticality,
    reopenCount: issue.reopenCount,
  });
  return { priorityScore: p.score, priorityBand: p.band, priorityBreakdown: p.breakdown };
}

/**
 * Validates permission and state, and returns the patch to apply.
 * Throws DomainError (FORBIDDEN / INVALID_STATE / VALIDATION) otherwise.
 */
export function planTransition(ctx: TransitionContext): TransitionPlan {
  const { issue, action, actor, payload, now } = ctx;
  const at = iso(now);
  const isSystem = actor === 'SYSTEM';

  const requireStaffOfDept = () => {
    if (isSystem || !isStaff(actor)) throw new DomainError('FORBIDDEN', 'Only maintenance staff can do this');
    if (!canActForDepartment(actor, issue.department)) {
      throw new DomainError('FORBIDDEN', 'This issue belongs to another department');
    }
  };
  const requireAssignee = () => {
    if (isSystem || !isStaff(actor)) throw new DomainError('FORBIDDEN', 'Only maintenance staff can do this');
    if (issue.assigneeSub !== actor.sub) throw new DomainError('FORBIDDEN', 'Only the assigned staff member can do this');
  };
  const requireAdmin = () => {
    if (isSystem || !isAdmin(actor)) throw new DomainError('FORBIDDEN', 'Only administrators can do this');
  };
  const requireReporter = () => {
    if (isSystem) throw new DomainError('FORBIDDEN', 'Only a reporter can verify a fix');
    if (!ctx.isLinkedReporter) throw new DomainError('FORBIDDEN', 'Only people who reported or confirmed this issue can verify the fix');
  };

  switch (action) {
    case 'ACCEPT': {
      requireStaffOfDept();
      requireStatus(issue, ['OPEN', 'REOPENED'], action);
      const a = actor as Actor;
      return {
        toStatus: 'ACKNOWLEDGED',
        patch: {
          status: 'ACKNOWLEDGED',
          assigneeSub: a.sub,
          assigneeName: a.displayName ?? a.username,
          acknowledgedAt: issue.acknowledgedAt ?? at,
        },
        event: { type: 'ACCEPT', actorRole: 'STAFF', note: optionalNote(payload.note, 500), evidenceKeys: [] },
      };
    }
    case 'DECLINE': {
      requireStaffOfDept();
      requireStatus(issue, ['OPEN', 'REOPENED'], action);
      const reason = requireNote(payload.note, 5, 500, 'Reason');
      return {
        toStatus: issue.status,
        patch: { department: TRIAGE, declineReason: reason, assigneeSub: null, assigneeName: null },
        event: { type: 'DECLINE', actorRole: 'STAFF', note: reason, evidenceKeys: [] },
      };
    }
    case 'START': {
      requireAssignee();
      requireStatus(issue, ['ACKNOWLEDGED'], action);
      return {
        toStatus: 'IN_PROGRESS',
        patch: { status: 'IN_PROGRESS', startedAt: at },
        event: { type: 'START', actorRole: 'STAFF', note: optionalNote(payload.note, 500), evidenceKeys: [] },
      };
    }
    case 'RESOLVE': {
      requireAssignee();
      requireStatus(issue, ['ACKNOWLEDGED', 'IN_PROGRESS'], action);
      const remarks = requireNote(payload.note, 10, 1000, 'Resolution remarks');
      const evidence = payload.evidenceKeys ?? [];
      if (ctx.issueType.evidenceRequired && evidence.length === 0) {
        throw new DomainError('VALIDATION', 'A photo of the repair is required for this issue type');
      }
      if (evidence.length > 3) throw new DomainError('VALIDATION', 'At most 3 evidence photos');
      return {
        toStatus: 'RESOLVED',
        patch: {
          status: 'RESOLVED',
          resolvedAt: at,
          startedAt: issue.startedAt ?? at,
          resolutionRemarks: remarks,
          repairEvidenceKeys: evidence,
          verificationOutcome: null,
        },
        event: { type: 'RESOLVE', actorRole: 'STAFF', note: remarks, evidenceKeys: evidence },
      };
    }
    case 'VERIFY_FIXED': {
      requireReporter();
      requireStatus(issue, ['RESOLVED'], action);
      const rating = payload.rating ?? null;
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        throw new DomainError('VALIDATION', 'Rating must be a whole number from 1 to 5');
      }
      const comment = optionalNote(payload.note, 500);
      return {
        toStatus: 'CLOSED',
        patch: {
          status: 'CLOSED',
          closedAt: at,
          verificationOutcome: 'FIXED',
          verificationRating: rating,
          verificationComment: comment,
        },
        event: { type: 'VERIFY_FIXED', actorRole: 'STUDENT', note: comment, evidenceKeys: [] },
      };
    }
    case 'VERIFY_NOT_FIXED': {
      requireReporter();
      requireStatus(issue, ['RESOLVED'], action);
      const comment = optionalNote(payload.note, 500);
      const reopened: IssueRecord = { ...issue, status: 'REOPENED', reopenCount: issue.reopenCount + 1, lastOpenedAt: at };
      return {
        toStatus: 'REOPENED',
        patch: {
          status: 'REOPENED',
          reopenCount: reopened.reopenCount,
          lastOpenedAt: at,
          slaDueAt: slaDueAt(at, issue.severity),
          slaBreached: false,
          resolvedAt: null,
          verificationOutcome: 'NOT_FIXED',
          verificationComment: comment,
        },
        event: { type: 'VERIFY_NOT_FIXED', actorRole: 'STUDENT', note: comment, evidenceKeys: payload.evidenceKeys ?? [] },
      };
    }
    case 'REASSIGN': {
      requireAdmin();
      requireStatus(issue, ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'], action);
      const dept = payload.department ?? '';
      if (!isDepartmentCode(dept)) throw new DomainError('VALIDATION', 'Choose a valid department');
      const nextStatus: IssueStatus = issue.status === 'REOPENED' ? 'REOPENED' : 'OPEN';
      return {
        toStatus: nextStatus,
        patch: { department: dept, status: nextStatus, assigneeSub: null, assigneeName: null, declineReason: null },
        event: { type: 'REASSIGN', actorRole: 'ADMIN', note: optionalNote(payload.note, 500) ?? `Routed to ${DEPARTMENTS[dept].label.en}`, evidenceKeys: [] },
      };
    }
    case 'MARK_INVALID': {
      requireAdmin();
      if (!isActive(issue.status)) throw new DomainError('INVALID_STATE', `Cannot mark an issue that is ${issue.status} as invalid`);
      const reason = requireNote(payload.note, 5, 500, 'Reason');
      return {
        toStatus: 'INVALID',
        patch: { status: 'INVALID', closedAt: at, invalidReason: reason },
        event: { type: 'MARK_INVALID', actorRole: 'ADMIN', note: reason, evidenceKeys: [] },
      };
    }
    case 'AUTO_CLOSE': {
      if (!isSystem) throw new DomainError('FORBIDDEN', 'Only the system can auto-close');
      requireStatus(issue, ['RESOLVED'], action);
      if (!issue.resolvedAt || hoursBetween(issue.resolvedAt, now) < VERIFICATION_WINDOW_HOURS) {
        throw new DomainError('INVALID_STATE', 'Verification window has not elapsed');
      }
      return {
        toStatus: 'CLOSED_UNVERIFIED',
        patch: { status: 'CLOSED_UNVERIFIED', closedAt: at },
        event: { type: 'AUTO_CLOSE', actorRole: 'SYSTEM', note: `No reporter response within ${VERIFICATION_WINDOW_HOURS} hours`, evidenceKeys: [] },
      };
    }
    default: {
      const never: never = action;
      throw new DomainError('VALIDATION', `Unknown action ${String(never)}`);
    }
  }
}

/** Which actions a given viewer may take on an issue: drives the UI so no button is dead. */
export function availableActions(issue: IssueRecord, actor: Actor, isLinkedReporter: boolean): IssueAction[] {
  const out: IssueAction[] = [];
  const staffHere = isStaff(actor) && canActForDepartment(actor, issue.department);
  const mine = isStaff(actor) && issue.assigneeSub === actor.sub;
  if (staffHere && (issue.status === 'OPEN' || issue.status === 'REOPENED')) out.push('ACCEPT', 'DECLINE');
  if (mine && issue.status === 'ACKNOWLEDGED') out.push('START');
  if (mine && (issue.status === 'ACKNOWLEDGED' || issue.status === 'IN_PROGRESS')) out.push('RESOLVE');
  if (isLinkedReporter && issue.status === 'RESOLVED') out.push('VERIFY_FIXED', 'VERIFY_NOT_FIXED');
  if (isAdmin(actor) && ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(issue.status)) out.push('REASSIGN');
  if (isAdmin(actor) && isActive(issue.status)) out.push('MARK_INVALID');
  return out;
}

export const slaHoursFor = (issue: Pick<IssueRecord, 'severity'>) => SLA_HOURS[issue.severity];
