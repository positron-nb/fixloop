/**
 * FixLoop issue service: all business rules that change data.
 *
 * Clients cannot write Issue/Report/IssueEvent records directly (see data/resource.ts);
 * every change goes through this service, which runs inside a Lambda function
 * behind authenticated AppSync custom mutations.
 */
import {
  DEPARTMENTS,
  getIssueType,
  isDepartmentCode,
  type IssueType,
} from '../../../shared/catalog';
import { lockKey, reportId, type ReportOutcome } from '../../../shared/dedupe';
import { buildDemoDataset } from '../../../shared/demo';
import { DomainError } from '../../../shared/errors';
import { computePriority, effectiveSeverity, slaDueAt } from '../../../shared/priority';
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  isActive,
  isAwaitingWork,
  type Actor,
  type IssueEventRecord,
  type IssueRecord,
  type ReportRecord,
} from '../../../shared/types';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  assertAssetCode,
  assertPhotoKeys,
  cleanText,
} from '../../../shared/validation';
import {
  REPORTER_ACTIONS,
  isAdmin,
  planTransition,
  reprioritise,
  type IssueAction,
} from '../../../shared/workflow';
import { ConflictError, type Directory, type PhotoInspector, type Repo } from './repo';

export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

export interface ServiceDeps {
  repo: Repo;
  photos?: PhotoInspector;
  directory?: Directory;
  now?: () => Date;
  newId?: () => string;
  log?: Logger;
}

export const MAX_REPORTS_PER_HOUR = 10;

export interface ReportIssueInput {
  assetId: string;
  issueType: string;
  safetyHazard?: boolean | null;
  description?: string | null;
  photoKeys?: (string | null)[] | null;
  submitMs?: number | null;
}

export interface ConfirmIssueInput {
  issueId: string;
  note?: string | null;
  photoKeys?: (string | null)[] | null;
  submitMs?: number | null;
}

export interface IssueActionInput {
  issueId: string;
  action: string;
  note?: string | null;
  evidenceKeys?: (string | null)[] | null;
  department?: string | null;
  rating?: number | null;
}

export interface ReportResult {
  outcome: ReportOutcome;
  issue: IssueRecord;
}

const ACTIONS: IssueAction[] = ['ACCEPT', 'DECLINE', 'START', 'RESOLVE', 'VERIFY_FIXED', 'VERIFY_NOT_FIXED', 'REASSIGN', 'MARK_INVALID'];
const noopLog: Logger = { info() {}, warn() {}, error() {} };
const compact = (a: (string | null)[] | null | undefined) => (a ?? []).filter((x): x is string => typeof x === 'string');

export class IssueService {
  private repo: Repo;
  private photos?: PhotoInspector;
  private directory?: Directory;
  private now: () => Date;
  private newId: () => string;
  private log: Logger;

  constructor(deps: ServiceDeps) {
    this.repo = deps.repo;
    this.photos = deps.photos;
    this.directory = deps.directory;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => globalThis.crypto.randomUUID());
    this.log = deps.log ?? noopLog;
  }

  // ───────────────────────── Reporting ─────────────────────────

  async reportIssue(actor: Actor, input: ReportIssueInput): Promise<ReportResult> {
    this.requireActor(actor);
    const assetId = assertAssetCode(input.assetId ?? '');
    const asset = await this.repo.getAsset(assetId);
    if (!asset) throw new DomainError('NOT_FOUND', `No asset with code ${assetId}`);
    if (asset.status !== 'ACTIVE') throw new DomainError('INVALID_STATE', 'This asset has been retired');

    const issueType = getIssueType(asset.assetType, input.issueType);
    if (!issueType) throw new DomainError('VALIDATION', 'Choose a problem type for this asset');

    const description = cleanText(input.description, 500, 'Description');
    if (issueType.freeform && (!description || description.length < 5)) {
      throw new DomainError('VALIDATION', 'Please describe the problem (at least 5 characters)');
    }
    const photoKeys = assertPhotoKeys(compact(input.photoKeys), 'report');
    await this.checkPhotos(photoKeys);
    const submitMs = this.cleanSubmitMs(input.submitMs);
    await this.enforceRateLimit(actor);

    if (!issueType.freeform) {
      const key = lockKey(asset.id, issueType.code);
      for (let attempt = 0; attempt < 3; attempt++) {
        const lock = await this.repo.getLock(key);
        if (lock) {
          const existing = await this.repo.getIssue(lock.issueId);
          if (existing && isActive(existing.status)) {
            this.log.info('report merged into existing issue', { issueId: existing.id, assetId });
            return this.addConfirmation(actor, existing, { note: description, photoKeys, submitMs });
          }
          await this.repo.releaseLock(key); // stale lock: the issue is closed
          continue;
        }
        const id = this.newId();
        if (await this.repo.claimLock(key, id)) {
          return { outcome: 'CREATED', issue: await this.createIssue(id, actor, asset, issueType, { description, photoKeys, submitMs, safetyHazard: !!input.safetyHazard }) };
        }
      }
      throw new DomainError('CONFLICT', 'Someone is reporting the same problem right now. Please try again.');
    }

    const id = this.newId();
    return { outcome: 'CREATED', issue: await this.createIssue(id, actor, asset, issueType, { description, photoKeys, submitMs, safetyHazard: !!input.safetyHazard }) };
  }

  async confirmIssue(actor: Actor, input: ConfirmIssueInput): Promise<ReportResult> {
    this.requireActor(actor);
    const issue = await this.repo.getIssue(String(input.issueId ?? ''));
    if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found');
    if (!isActive(issue.status)) throw new DomainError('INVALID_STATE', 'This issue is already closed. Report it again if the problem is back.');
    const note = cleanText(input.note, 500, 'Note');
    const photoKeys = assertPhotoKeys(compact(input.photoKeys), 'report');
    await this.checkPhotos(photoKeys);
    await this.enforceRateLimit(actor);
    return this.addConfirmation(actor, issue, { note, photoKeys, submitMs: this.cleanSubmitMs(input.submitMs) });
  }

  private async createIssue(
    id: string,
    actor: Actor,
    asset: { id: string; name: string; assetType: string; building: string; locationLabel: string; criticality: number; isDemo: boolean },
    issueType: IssueType,
    input: { description: string | null; photoKeys: string[]; submitMs: number | null; safetyHazard: boolean },
  ): Promise<IssueRecord> {
    const at = this.now().toISOString();
    const severity = effectiveSeverity(issueType.defaultSeverity, input.safetyHazard, issueType.safetyRelevant);
    const p = computePriority({
      severity,
      issueTypeWeight: issueType.weight,
      confirmations: 0,
      hoursWaiting: 0,
      assetCriticality: asset.criticality,
      reopenCount: 0,
    });
    const issue: IssueRecord = {
      id,
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.assetType,
      building: asset.building,
      locationLabel: asset.locationLabel,
      issueType: issueType.code,
      department: issueType.department,
      severity,
      status: 'OPEN',
      description: input.description,
      photoKeys: input.photoKeys,
      priorityScore: p.score,
      priorityBand: p.band,
      priorityBreakdown: p.breakdown,
      confirmationCount: 0,
      reopenCount: 0,
      escalationLevel: 0,
      assetCriticality: asset.criticality,
      reportedAt: at,
      lastOpenedAt: at,
      slaDueAt: slaDueAt(at, severity),
      slaBreached: false,
      repairEvidenceKeys: [],
      submitMs: input.submitMs,
      isDemo: asset.isDemo,
    };
    const created = await this.repo.createIssue(issue);
    await this.repo.createReport({
      id: reportId(id, actor.sub),
      issueId: id,
      assetId: asset.id,
      reporterSub: actor.sub,
      kind: 'ORIGINAL',
      note: input.description,
      photoKeys: input.photoKeys,
      submitMs: input.submitMs,
      createdAt: at,
      isDemo: asset.isDemo,
    });
    await this.event(created, {
      type: 'REPORTED',
      toStatus: 'OPEN',
      actorRole: 'STUDENT',
      note: `Routed to ${DEPARTMENTS[issueType.department].label.en} · ${p.band} (${p.score})`,
      evidenceKeys: input.photoKeys,
    });
    this.log.info('issue created', { issueId: id, assetId: asset.id, issueType: issueType.code, department: issueType.department, priority: p.score });
    return created;
  }

  private async addConfirmation(
    actor: Actor,
    issue: IssueRecord,
    input: { note: string | null; photoKeys: string[]; submitMs: number | null },
  ): Promise<ReportResult> {
    const rid = reportId(issue.id, actor.sub);
    let isNewReporter = true;
    try {
      await this.repo.createReport({
        id: rid,
        issueId: issue.id,
        assetId: issue.assetId,
        reporterSub: actor.sub,
        kind: 'CONFIRMATION',
        note: input.note,
        photoKeys: input.photoKeys,
        submitMs: input.submitMs,
        createdAt: this.now().toISOString(),
        isDemo: issue.isDemo,
      });
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      isNewReporter = false;
    }

    // A fresh report while the fix awaits verification means the fix did not hold.
    if (issue.status === 'RESOLVED') {
      const updated = await this.applyAction(actor, issue, 'VERIFY_NOT_FIXED', {
        note: input.note ?? 'Reported again while the fix was awaiting verification',
        evidenceKeys: input.photoKeys,
      }, true);
      if (isNewReporter) await this.recountConfirmations(updated);
      return { outcome: 'REOPENED', issue: (await this.repo.getIssue(issue.id)) ?? updated };
    }

    if (!isNewReporter) return { outcome: 'ALREADY_REPORTED', issue };

    const updated = await this.recountConfirmations(issue);
    await this.event(updated, {
      type: 'CONFIRMED',
      toStatus: updated.status,
      actorRole: 'STUDENT',
      note: input.note ? `Confirmed: ${input.note}` : `Independent confirmation #${updated.confirmationCount}`,
      evidenceKeys: input.photoKeys,
    });
    return { outcome: 'CONFIRMED', issue: updated };
  }

  private async recountConfirmations(issue: IssueRecord): Promise<IssueRecord> {
    const reports = await this.repo.listReportsByIssue(issue.id);
    const confirmationCount = reports.filter((r) => r.kind === 'CONFIRMATION').length;
    const issueType = this.issueTypeOf(issue);
    const next = { ...issue, confirmationCount };
    return this.repo.updateIssue(issue.id, { confirmationCount, ...reprioritise(next, issueType, this.now()) });
  }

  // ───────────────────────── Workflow actions ─────────────────────────

  async issueAction(actor: Actor, input: IssueActionInput): Promise<IssueRecord> {
    this.requireActor(actor);
    const action = String(input.action ?? '') as IssueAction;
    if (!ACTIONS.includes(action)) throw new DomainError('VALIDATION', 'Unknown action');
    const issue = await this.repo.getIssue(String(input.issueId ?? ''));
    if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found');

    const evidenceKind = REPORTER_ACTIONS.includes(action) ? 'report' : 'repair';
    const evidenceKeys = assertPhotoKeys(compact(input.evidenceKeys), evidenceKind);
    await this.checkPhotos(evidenceKeys);
    if (action === 'REASSIGN' && input.department && !isDepartmentCode(input.department)) {
      throw new DomainError('VALIDATION', 'Choose a valid department');
    }
    const isLinkedReporter = REPORTER_ACTIONS.includes(action)
      ? !!(await this.repo.getReport(reportId(issue.id, actor.sub)))
      : false;
    if (action === 'ACCEPT' && !actor.displayName && this.directory) {
      actor = { ...actor, displayName: (await this.directory.displayName(actor.username)) ?? undefined };
    }
    return this.applyAction(actor, issue, action, {
      note: cleanText(input.note, 1000, 'Note'),
      evidenceKeys,
      department: input.department ?? null,
      rating: input.rating ?? null,
    }, isLinkedReporter);
  }

  private async applyAction(
    actor: Actor | 'SYSTEM',
    issue: IssueRecord,
    action: IssueAction,
    payload: { note?: string | null; evidenceKeys?: string[]; department?: string | null; rating?: number | null },
    isLinkedReporter: boolean,
  ): Promise<IssueRecord> {
    const now = this.now();
    const issueType = this.issueTypeOf(issue);
    const plan = planTransition({ issue, action, actor, payload, isLinkedReporter, issueType, now });
    const merged: IssueRecord = { ...issue, ...plan.patch };
    const updated = await this.repo.updateIssue(issue.id, { ...plan.patch, ...reprioritise(merged, issueType, now) }, issue.status);

    if ((action === 'VERIFY_FIXED' || action === 'VERIFY_NOT_FIXED') && actor !== 'SYSTEM') {
      await this.repo.updateReport(reportId(issue.id, actor.sub), {
        verification: action === 'VERIFY_FIXED' ? 'FIXED' : 'NOT_FIXED',
        verifiedAt: now.toISOString(),
      });
    }
    if (TERMINAL_STATUSES.includes(plan.toStatus)) {
      const key = lockKey(issue.assetId, issue.issueType);
      const lock = await this.repo.getLock(key);
      if (lock?.issueId === issue.id) await this.repo.releaseLock(key);
    }
    await this.event(updated, {
      type: plan.event.type,
      fromStatus: issue.status,
      toStatus: plan.toStatus,
      actorRole: plan.event.actorRole,
      actorName: actor !== 'SYSTEM' && plan.event.actorRole !== 'STUDENT' ? (actor.displayName ?? actor.username) : null,
      note: plan.event.note ?? null,
      evidenceKeys: plan.event.evidenceKeys,
    });
    this.log.info('issue transition', { issueId: issue.id, action, from: issue.status, to: plan.toStatus });
    return updated;
  }

  // ───────────────────────── Student views ─────────────────────────

  async myReports(actor: Actor): Promise<{ report: ReportRecord; issue: IssueRecord }[]> {
    this.requireActor(actor);
    const reports = (await this.repo.listReportsByReporter(actor.sub)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    const issues = await Promise.all(reports.map((r) => this.repo.getIssue(r.issueId)));
    return reports
      .map((report, k) => ({ report, issue: issues[k] }))
      .filter((x): x is { report: ReportRecord; issue: IssueRecord } => !!x.issue);
  }

  // ───────────────────────── Scheduled SLA sweep ─────────────────────────

  async sweep(): Promise<{ checked: number; escalated: number; autoClosed: number; reprioritised: number }> {
    const now = this.now();
    const issues = await this.repo.listActiveIssues();
    let escalated = 0;
    let autoClosed = 0;
    let reprioritisedCount = 0;
    for (const issue of issues) {
      try {
        if (issue.status === 'RESOLVED') {
          if (issue.resolvedAt && now.getTime() - new Date(issue.resolvedAt).getTime() >= 72 * 3_600_000) {
            await this.applyAction('SYSTEM', issue, 'AUTO_CLOSE', {}, false);
            autoClosed++;
          }
          continue;
        }
        if (!isAwaitingWork(issue.status)) continue;
        const issueType = this.issueTypeOf(issue);
        const p = reprioritise(issue, issueType, now);
        const breached = now.getTime() > new Date(issue.slaDueAt).getTime();
        if (breached && !issue.slaBreached) {
          const updated = await this.repo.updateIssue(issue.id, { ...p, slaBreached: true, escalationLevel: issue.escalationLevel + 1 });
          await this.event(updated, {
            type: 'ESCALATED',
            fromStatus: issue.status,
            toStatus: issue.status,
            actorRole: 'SYSTEM',
            note: `Service target missed. Escalated to administrators (level ${updated.escalationLevel})`,
            evidenceKeys: [],
          });
          escalated++;
        } else if (p.priorityScore !== issue.priorityScore) {
          await this.repo.updateIssue(issue.id, p);
          reprioritisedCount++;
        }
      } catch (e) {
        this.log.error('sweep failed for issue', { issueId: issue.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    const summary = { checked: issues.length, escalated, autoClosed, reprioritised: reprioritisedCount };
    this.log.info('sla sweep complete', summary);
    return summary;
  }

  // ───────────────────────── Administration ─────────────────────────

  async inviteStaff(actor: Actor, input: { email: string; name: string; department?: string | null; makeAdmin?: boolean | null }) {
    this.requireAdmin(actor);
    if (!this.directory) throw new DomainError('INTERNAL', 'User directory unavailable');
    const email = String(input.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) throw new DomainError('VALIDATION', 'Enter a valid email address');
    const name = cleanText(input.name, 60, 'Name');
    if (!name || name.length < 2) throw new DomainError('VALIDATION', 'Enter a name');
    const department = input.department ?? '';
    if (!input.makeAdmin && !isDepartmentCode(department)) throw new DomainError('VALIDATION', 'Choose a department for staff');
    if (department && !isDepartmentCode(department)) throw new DomainError('VALIDATION', 'Choose a valid department');
    const res = await this.directory.inviteStaff({ email, name, department, makeAdmin: !!input.makeAdmin });
    this.log.info('staff invited', { department, makeAdmin: !!input.makeAdmin, created: res.created });
    return res;
  }

  async listStaff(actor: Actor) {
    this.requireAdmin(actor);
    if (!this.directory) throw new DomainError('INTERNAL', 'User directory unavailable');
    return this.directory.listStaff();
  }

  async demoData(actor: Actor, action: string) {
    this.requireAdmin(actor);
    if (action === 'LOAD') {
      const existing = (await this.repo.listAssets()).filter((a) => a.isDemo);
      if (existing.length) throw new DomainError('CONFLICT', 'Demo data is already loaded. Clear it first.');
      const ds = buildDemoDataset(this.now());
      for (const a of ds.assets) await this.repo.createAsset(a);
      for (const i of ds.issues) {
        await this.repo.createIssue(i);
        if (isActive(i.status) && !getIssueType(i.assetType, i.issueType)?.freeform) {
          await this.repo.claimLock(lockKey(i.assetId, i.issueType), i.id);
        }
      }
      for (const r of ds.reports) await this.repo.createReport(r);
      for (const e of ds.events) await this.repo.createEvent(e);
      this.log.info('demo data loaded', { assets: ds.assets.length, issues: ds.issues.length });
      return { assets: ds.assets.length, issues: ds.issues.length };
    }
    if (action === 'CLEAR') {
      const issues = (await this.repo.listAllIssues()).filter((i) => i.isDemo);
      for (const i of issues) {
        for (const r of await this.repo.listReportsByIssue(i.id)) await this.repo.deleteReport(r.id);
        for (const e of await this.repo.listEventsByIssue(i.id)) await this.repo.deleteEvent(e.id);
        const key = lockKey(i.assetId, i.issueType);
        const lock = await this.repo.getLock(key);
        if (lock?.issueId === i.id) await this.repo.releaseLock(key);
        await this.repo.deleteIssue(i.id);
      }
      const assets = (await this.repo.listAssets()).filter((a) => a.isDemo);
      for (const a of assets) await this.repo.deleteAsset(a.id);
      this.log.info('demo data cleared', { assets: assets.length, issues: issues.length });
      return { assets: assets.length, issues: issues.length };
    }
    throw new DomainError('VALIDATION', 'Action must be LOAD or CLEAR');
  }

  // ───────────────────────── helpers ─────────────────────────

  private requireActor(actor: Actor | null | undefined): asserts actor is Actor {
    if (!actor || !actor.sub) throw new DomainError('UNAUTHENTICATED', 'Please sign in');
  }

  private requireAdmin(actor: Actor) {
    this.requireActor(actor);
    if (!isAdmin(actor)) throw new DomainError('FORBIDDEN', 'Only administrators can do this');
  }

  private issueTypeOf(issue: IssueRecord): IssueType {
    const t = getIssueType(issue.assetType, issue.issueType);
    if (!t) throw new DomainError('INTERNAL', `Unknown issue type ${issue.assetType}/${issue.issueType}`);
    return t;
  }

  private cleanSubmitMs(v: number | null | undefined): number | null {
    if (v == null) return null;
    if (!Number.isFinite(v) || v < 0) return null;
    return Math.min(Math.round(v), 30 * 60_000); // cap at 30 min: anything longer is an idle tab, not effort
  }

  private async enforceRateLimit(actor: Actor) {
    const since = this.now().getTime() - 3_600_000;
    const recent = (await this.repo.listReportsByReporter(actor.sub)).filter((r) => new Date(r.createdAt).getTime() >= since);
    if (recent.length >= MAX_REPORTS_PER_HOUR) {
      throw new DomainError('RATE_LIMITED', 'You have sent many reports in the last hour. Please try again later.');
    }
  }

  private async checkPhotos(keys: string[]) {
    if (!this.photos || !keys.length) return;
    for (const key of keys) {
      const info = await this.photos.inspect(key);
      if (!info.exists) throw new DomainError('VALIDATION', 'A photo upload did not finish. Please re-attach it.');
      if ((info.size ?? 0) > MAX_PHOTO_BYTES) throw new DomainError('VALIDATION', 'Photo is larger than 5 MB');
      if (info.contentType && !ALLOWED_PHOTO_TYPES.includes(info.contentType)) {
        throw new DomainError('VALIDATION', 'Only JPEG, PNG or WebP photos are allowed');
      }
    }
  }

  private async event(issue: IssueRecord, e: Omit<IssueEventRecord, 'issueId' | 'at' | 'isDemo'>) {
    await this.repo.createEvent({ ...e, issueId: issue.id, at: this.now().toISOString(), isDemo: issue.isDemo });
  }
}

export { ACTIVE_STATUSES };
