/**
 * End-to-end business rules of the issue service, run against an in-memory repository.
 * Covers: QR identification, issue creation, duplicate consolidation, prioritisation,
 * department routing, role-based authorization, staff workflow, evidence, verification,
 * reopening, SLA escalation, auto-close, unauthenticated access and error handling.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IssueService, MAX_REPORTS_PER_HOUR } from '../amplify/functions/issue-api/service';
import { lockKey, reportId } from '../shared/dedupe';
import { DomainError } from '../shared/errors';
import type { Actor, AssetRecord } from '../shared/types';
import { Clock, FakeDirectory, FakePhotos, MemoryRepo } from './helpers/memoryRepo';

const asset: AssetRecord = {
  id: 'H4-WC-01',
  name: 'Water cooler · Ground floor',
  assetType: 'WATER_COOLER',
  building: 'Hostel 4',
  floor: 'Ground',
  locationLabel: 'Near main stairs',
  criticality: 3,
  status: 'ACTIVE',
  isDemo: false,
};

const student = (n: number): Actor => ({ sub: `stu-${n}`, username: `stu-${n}`, groups: ['STUDENT'] });
const plumber: Actor = { sub: 'staff-p', username: 'ramesh', groups: ['STAFF', 'DEPT_PLUMBING'] };
const plumber2: Actor = { sub: 'staff-p2', username: 'raju', groups: ['STAFF', 'DEPT_PLUMBING'] };
const electrician: Actor = { sub: 'staff-e', username: 'suresh', groups: ['STAFF', 'DEPT_ELECTRICAL'] };
const admin: Actor = { sub: 'admin-1', username: 'warden', groups: ['ADMIN'] };
const photoKey = (who: string, file = 'a.jpg') => `reports/ap-south-1:${who.padEnd(8, '0').slice(0, 8)}-1111-2222-3333-444455556666/${file}`;

let repo: MemoryRepo;
let photos: FakePhotos;
let clock: Clock;
let svc: IssueService;
let ids: number;

beforeEach(async () => {
  repo = new MemoryRepo();
  photos = new FakePhotos();
  clock = new Clock();
  ids = 0;
  svc = new IssueService({ repo, photos, directory: new FakeDirectory(), now: clock.now, newId: () => `issue-${++ids}` });
  await repo.createAsset(asset);
  await repo.createAsset({ ...asset, id: 'H4-LT-01', name: 'Corridor light', assetType: 'LIGHT', criticality: 1 });
});

const expectError = async (p: Promise<unknown>, code: DomainError['code']) => {
  await expect(p).rejects.toBeInstanceOf(DomainError);
  await p.catch((e: DomainError) => expect(e.code).toBe(code));
};

describe('QR identification and reporting', () => {
  it('normalises scanned codes and rejects unknown or retired assets', async () => {
    const r = await svc.reportIssue(student(1), { assetId: ' h4-wc-01 ', issueType: 'NO_WATER' });
    expect(r.issue.assetId).toBe('H4-WC-01');
    await expectError(svc.reportIssue(student(1), { assetId: 'NOPE-404', issueType: 'NO_WATER' }), 'NOT_FOUND');
    await expectError(svc.reportIssue(student(1), { assetId: 'bad code!!', issueType: 'NO_WATER' }), 'VALIDATION');
    await repo.createAsset({ ...asset, id: 'H4-OLD-01', status: 'RETIRED' });
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-OLD-01', issueType: 'NO_WATER' }), 'INVALID_STATE');
  });

  it('rejects issue types that do not belong to the asset type', async () => {
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'FLICKERING' }), 'VALIDATION');
  });

  it('creates an issue routed to the correct department with a stored priority breakdown and SLA', async () => {
    const r = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NOT_COOLING', description: 'Warm water', submitMs: 18_000 });
    expect(r.outcome).toBe('CREATED');
    expect(r.issue.department).toBe('ELECTRICAL'); // cooling is electrical, not plumbing
    expect(r.issue.status).toBe('OPEN');
    expect(r.issue.severity).toBe('MEDIUM');
    expect(r.issue.priorityBreakdown).toMatchObject({ severity: 12, issueType: 6, assetCriticality: 12 });
    expect(r.issue.slaDueAt).toBe('2026-11-23T09:00:00.000Z'); // MEDIUM = 72h
    expect(r.issue.submitMs).toBe(18_000);
    expect(repo.events.map((e) => e.type)).toEqual(['REPORTED']);
    expect(repo.events[0].actorName ?? null).toBeNull(); // reporter identity never in the timeline
    expect(repo.locks.get(lockKey('H4-WC-01', 'NOT_COOLING'))).toBe(r.issue.id);
  });

  it('safety flag raises a safety-relevant issue to CRITICAL with a 4h SLA', async () => {
    const r = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'LEAKING', safetyHazard: true });
    expect(r.issue.severity).toBe('CRITICAL');
    expect(r.issue.slaDueAt).toBe('2026-11-20T13:00:00.000Z');
    // Not safety relevant → flag ignored
    const r2 = await svc.reportIssue(student(2), { assetId: 'H4-WC-01', issueType: 'NOT_COOLING', safetyHazard: true });
    expect(r2.issue.severity).toBe('MEDIUM');
  });

  it('requires a description for "something else" and never merges free-form reports', async () => {
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'OTHER' }), 'VALIDATION');
    const a = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'OTHER', description: 'Tap handle missing' });
    const b = await svc.reportIssue(student(2), { assetId: 'H4-WC-01', issueType: 'OTHER', description: 'Cooler body is rusted' });
    expect(a.outcome).toBe('CREATED');
    expect(b.outcome).toBe('CREATED');
    expect(a.issue.id).not.toBe(b.issue.id);
  });

  it('validates photo references and checks the object exists in storage', async () => {
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER', photoKeys: ['../../etc/passwd'] }), 'VALIDATION');
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER', photoKeys: [photoKey('a')] }), 'VALIDATION'); // not uploaded
    photos.put(photoKey('b'), 9_000_000);
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER', photoKeys: [photoKey('b')] }), 'VALIDATION'); // > 5 MB
    photos.put(photoKey('c'), 1000, 'application/pdf');
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER', photoKeys: [photoKey('c')] }), 'VALIDATION');
    const ok = photos.put(photoKey('d'));
    const r = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER', photoKeys: [ok] });
    expect(r.issue.photoKeys).toEqual([ok]);
  });

  it('rejects unauthenticated callers', async () => {
    await expectError(svc.reportIssue({ sub: '', username: '', groups: [] }, { assetId: 'H4-WC-01', issueType: 'NO_WATER' }), 'UNAUTHENTICATED');
    await expectError(svc.myReports(undefined as unknown as Actor), 'UNAUTHENTICATED');
  });

  it(`rate-limits a single account to ${MAX_REPORTS_PER_HOUR} reports per hour`, async () => {
    for (let k = 0; k < MAX_REPORTS_PER_HOUR; k++) {
      await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'OTHER', description: `Different thing ${k}` });
    }
    await expectError(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'OTHER', description: 'One more' }), 'RATE_LIMITED');
    clock.advanceHours(1.01);
    await expect(svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'OTHER', description: 'Next hour' })).resolves.toBeTruthy();
  });
});

describe('duplicate consolidation', () => {
  it('turns a second report of the same fault into an independent confirmation and raises priority', async () => {
    const first = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    const second = await svc.reportIssue(student(2), { assetId: 'H4-WC-01', issueType: 'NO_WATER', description: 'Still dry' });
    expect(second.outcome).toBe('CONFIRMED');
    expect(second.issue.id).toBe(first.issue.id);
    expect(second.issue.confirmationCount).toBe(1);
    expect(second.issue.priorityScore).toBeGreaterThan(first.issue.priorityScore);
    expect(repo.issues.size).toBe(1);
    expect(repo.events.map((e) => e.type)).toEqual(['REPORTED', 'CONFIRMED']);
  });

  it('counts each person once: repeat reports from the same account change nothing', async () => {
    const first = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await svc.confirmIssue(student(2), { issueId: first.issue.id });
    const again = await svc.confirmIssue(student(2), { issueId: first.issue.id });
    const self = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    expect(again.outcome).toBe('ALREADY_REPORTED');
    expect(self.outcome).toBe('ALREADY_REPORTED');
    expect((await repo.getIssue(first.issue.id))!.confirmationCount).toBe(1);
  });

  it('a different fault on the same asset is a separate issue', async () => {
    const a = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    const b = await svc.reportIssue(student(2), { assetId: 'H4-WC-01', issueType: 'DIRTY' });
    expect(b.outcome).toBe('CREATED');
    expect(b.issue.id).not.toBe(a.issue.id);
    expect(b.issue.department).toBe('HOUSEKEEPING');
  });

  it('after an issue is closed, a new report opens a fresh issue (stale lock released)', async () => {
    const id = await resolveFlow();
    await svc.issueAction(student(1), { issueId: id, action: 'VERIFY_FIXED', rating: 5 });
    expect(repo.locks.has(lockKey('H4-WC-01', 'NO_WATER'))).toBe(false);
    const fresh = await svc.reportIssue(student(3), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    expect(fresh.outcome).toBe('CREATED');
    expect(fresh.issue.id).not.toBe(id);
  });

  it('a new report while a fix awaits verification reopens the issue (the fix did not hold)', async () => {
    const id = await resolveFlow();
    const r = await svc.reportIssue(student(4), { assetId: 'H4-WC-01', issueType: 'NO_WATER', description: 'Dry again' });
    expect(r.outcome).toBe('REOPENED');
    expect(r.issue.id).toBe(id);
    expect(r.issue.status).toBe('REOPENED');
    expect(r.issue.reopenCount).toBe(1);
  });

  it('confirming a closed issue is refused', async () => {
    const id = await resolveFlow();
    await svc.issueAction(student(1), { issueId: id, action: 'VERIFY_FIXED' });
    await expectError(svc.confirmIssue(student(9), { issueId: id }), 'INVALID_STATE');
  });
});

/** Report → accept → start → resolve with evidence. Returns the issue id. */
async function resolveFlow(): Promise<string> {
  const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
  await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
  await svc.issueAction(plumber, { issueId: issue.id, action: 'START' });
  const ev = photos.put('repairs/fix-1.jpg');
  await svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'Replaced the inlet valve', evidenceKeys: [ev] });
  return issue.id;
}

describe('staff workflow and role-based authorization', () => {
  it('only staff of the routed department can accept; accept assigns and timestamps', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await expectError(svc.issueAction(student(2), { issueId: issue.id, action: 'ACCEPT' }), 'FORBIDDEN');
    await expectError(svc.issueAction(electrician, { issueId: issue.id, action: 'ACCEPT' }), 'FORBIDDEN');
    await expectError(svc.issueAction(admin, { issueId: issue.id, action: 'ACCEPT' }), 'FORBIDDEN');
    clock.advanceHours(2);
    const acc = await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
    expect(acc.status).toBe('ACKNOWLEDGED');
    expect(acc.assigneeSub).toBe('staff-p');
    expect(acc.assigneeName).toBe('Name of ramesh');
    expect(acc.acknowledgedAt).toBe('2026-11-20T11:00:00.000Z');
  });

  it('only the assignee can start and resolve; illegal transitions are rejected', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'START' }), 'FORBIDDEN'); // not assigned yet
    await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' }), 'INVALID_STATE');
    await expectError(svc.issueAction(plumber2, { issueId: issue.id, action: 'START' }), 'FORBIDDEN');
    const started = await svc.issueAction(plumber, { issueId: issue.id, action: 'START' });
    expect(started.status).toBe('IN_PROGRESS');
  });

  it('resolving requires remarks and repair evidence (server-side, not just in the UI)', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'done' }), 'VALIDATION'); // too short
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'Replaced the valve' }), 'VALIDATION'); // no photo
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'Replaced the valve', evidenceKeys: ['repairs/missing.jpg'] }), 'VALIDATION');
    const ev = photos.put('repairs/ok.jpg');
    const res = await svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'Replaced the valve', evidenceKeys: [ev] });
    expect(res.status).toBe('RESOLVED'); // NOT closed: the reporter must verify
    expect(res.repairEvidenceKeys).toEqual([ev]);
  });

  it('Wi-Fi issues can be resolved without a photo (evidence not meaningful)', async () => {
    await repo.createAsset({ ...asset, id: 'AB-WIFI-01', assetType: 'WIFI_AP' });
    const it = await svc.reportIssue(student(1), { assetId: 'AB-WIFI-01', issueType: 'NO_CONNECTIVITY' });
    const it2: Actor = { sub: 'staff-it', username: 'kiran', groups: ['STAFF', 'DEPT_IT'] };
    await svc.issueAction(it2, { issueId: it.issue.id, action: 'ACCEPT' });
    const res = await svc.issueAction(it2, { issueId: it.issue.id, action: 'RESOLVE', note: 'Rebooted and re-patched the AP' });
    expect(res.status).toBe('RESOLVED');
  });

  it('declining sends the issue to admin triage; admin reassigns to the right department', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-LT-01', issueType: 'FLICKERING' });
    await expectError(svc.issueAction(electrician, { issueId: issue.id, action: 'DECLINE', note: 'no' }), 'VALIDATION');
    const declined = await svc.issueAction(electrician, { issueId: issue.id, action: 'DECLINE', note: 'UPS lights belong to IT' });
    expect(declined.department).toBe('TRIAGE');
    await expectError(svc.issueAction(electrician, { issueId: issue.id, action: 'ACCEPT' }), 'FORBIDDEN');
    await expectError(svc.issueAction(plumber, { issueId: issue.id, action: 'REASSIGN', department: 'IT' }), 'FORBIDDEN');
    await expectError(svc.issueAction(admin, { issueId: issue.id, action: 'REASSIGN', department: 'MARS' }), 'VALIDATION');
    const re = await svc.issueAction(admin, { issueId: issue.id, action: 'REASSIGN', department: 'IT' });
    expect(re.department).toBe('IT');
    expect(re.status).toBe('OPEN');
  });

  it('admin can mark a false report invalid with a reason; it then frees the asset for new reports', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await expectError(svc.issueAction(student(1), { issueId: issue.id, action: 'MARK_INVALID', note: 'prank report' }), 'FORBIDDEN');
    const inv = await svc.issueAction(admin, { issueId: issue.id, action: 'MARK_INVALID', note: 'Checked on site: working fine' });
    expect(inv.status).toBe('INVALID');
    expect(repo.locks.size).toBe(0);
  });

  it('two staff accepting at the same moment: the second write is rejected (optimistic concurrency)', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    // Simulate the race: plumber2 read the issue as OPEN before plumber's write landed.
    const stale = await repo.getIssue(issue.id);
    await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
    await expect(repo.updateIssue(issue.id, { assigneeSub: 'staff-p2' }, stale!.status)).rejects.toThrow('concurrently');
    expect((await repo.getIssue(issue.id))!.assigneeSub).toBe('staff-p');
  });

  it('rejects unknown actions and missing issues with clear codes', async () => {
    await expectError(svc.issueAction(plumber, { issueId: 'nope', action: 'ACCEPT' }), 'NOT_FOUND');
    await expectError(svc.issueAction(plumber, { issueId: 'nope', action: 'SELF_DESTRUCT' }), 'VALIDATION');
  });
});

describe('resolution verification', () => {
  it('only a reporter or confirmer can verify; staff and strangers cannot close an issue', async () => {
    const id = await resolveFlow();
    await expectError(svc.issueAction(plumber, { issueId: id, action: 'VERIFY_FIXED' }), 'FORBIDDEN');
    await expectError(svc.issueAction(student(99), { issueId: id, action: 'VERIFY_FIXED' }), 'FORBIDDEN');
    await expectError(svc.issueAction(admin, { issueId: id, action: 'VERIFY_FIXED' }), 'FORBIDDEN');
    const closed = await svc.issueAction(student(1), { issueId: id, action: 'VERIFY_FIXED', rating: 4, note: 'Works now' });
    expect(closed.status).toBe('CLOSED');
    expect(closed.verificationRating).toBe(4);
    expect((await repo.getReport(reportId(id, 'stu-1')))!.verification).toBe('FIXED');
  });

  it('a confirmer can also verify', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await svc.confirmIssue(student(2), { issueId: issue.id });
    await svc.issueAction(plumber, { issueId: issue.id, action: 'ACCEPT' });
    await svc.issueAction(plumber, { issueId: issue.id, action: 'RESOLVE', note: 'Valve replaced today', evidenceKeys: [photos.put('repairs/x.jpg')] });
    const closed = await svc.issueAction(student(2), { issueId: issue.id, action: 'VERIFY_FIXED' });
    expect(closed.status).toBe('CLOSED');
  });

  it('"not fixed" reopens with a fresh SLA, higher priority and back in the department queue', async () => {
    const id = await resolveFlow();
    const before = (await repo.getIssue(id))!;
    clock.advanceHours(5);
    const reopened = await svc.issueAction(student(1), { issueId: id, action: 'VERIFY_NOT_FIXED', note: 'Still no water' });
    expect(reopened.status).toBe('REOPENED');
    expect(reopened.reopenCount).toBe(1);
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.slaDueAt).toBe('2026-11-21T14:00:00.000Z');
    expect(reopened.priorityBreakdown.reopened).toBe(5);
    expect(reopened.priorityScore).toBeGreaterThan(before.priorityScore);
    const again = await svc.issueAction(plumber2, { issueId: id, action: 'ACCEPT' }); // anyone in the department may pick it up
    expect(again.status).toBe('ACKNOWLEDGED');
  });

  it('rating must be 1–5 and verification only applies to resolved issues', async () => {
    const { issue } = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'DIRTY' });
    await expectError(svc.issueAction(student(1), { issueId: issue.id, action: 'VERIFY_FIXED' }), 'INVALID_STATE');
    const housekeeping: Actor = { sub: 'staff-h', username: 'meena', groups: ['STAFF', 'DEPT_HOUSEKEEPING'] };
    await svc.issueAction(housekeeping, { issueId: issue.id, action: 'ACCEPT' });
    await svc.issueAction(housekeeping, { issueId: issue.id, action: 'RESOLVE', note: 'Cleaned and sanitised', evidenceKeys: [photos.put('repairs/y.jpg')] });
    await expectError(svc.issueAction(student(1), { issueId: issue.id, action: 'VERIFY_FIXED', rating: 9 }), 'VALIDATION');
    await expectError(svc.issueAction(student(1), { issueId: issue.id, action: 'VERIFY_FIXED', rating: 0 }), 'VALIDATION');
  });

  it('myReports lists only the caller’s own reports', async () => {
    const a = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    await svc.reportIssue(student(2), { assetId: 'H4-WC-01', issueType: 'DIRTY' });
    await svc.confirmIssue(student(2), { issueId: a.issue.id });
    const mine1 = await svc.myReports(student(1));
    const mine2 = await svc.myReports(student(2));
    expect(mine1.map((m) => m.report.kind)).toEqual(['ORIGINAL']);
    expect(mine2).toHaveLength(2);
    expect(mine2.every((m) => m.report.reporterSub === 'stu-2')).toBe(true);
  });
});

describe('SLA sweep', () => {
  it('escalates once when the target is missed, raises waiting priority, and auto-closes unverified fixes after 72h', async () => {
    const hazard = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'ELECTRIC_SHOCK' }); // CRITICAL, 4h
    const id = await resolveFlow(); // NO_WATER resolved at t0
    clock.advanceHours(5);
    const s1 = await svc.sweep();
    expect(s1.escalated).toBe(1);
    const h = (await repo.getIssue(hazard.issue.id))!;
    expect(h.slaBreached).toBe(true);
    expect(h.escalationLevel).toBe(1);
    expect(h.priorityBreakdown.waiting).toBe(20);
    expect(repo.events.some((e) => e.type === 'ESCALATED' && e.actorRole === 'SYSTEM')).toBe(true);

    const s2 = await svc.sweep();
    expect(s2.escalated).toBe(0); // no duplicate escalation

    clock.advanceHours(68);
    const s3 = await svc.sweep();
    expect(s3.autoClosed).toBe(1);
    expect((await repo.getIssue(id))!.status).toBe('CLOSED_UNVERIFIED');
  });
});

describe('administration', () => {
  it('only admins can invite staff, list staff or load demo data', async () => {
    await expectError(svc.inviteStaff(plumber, { email: 'a@b.in', name: 'A', department: 'IT' }), 'FORBIDDEN');
    await expectError(svc.listStaff(student(1)), 'FORBIDDEN');
    await expectError(svc.demoData(plumber, 'LOAD'), 'FORBIDDEN');
    await expectError(svc.inviteStaff(admin, { email: 'not-an-email', name: 'Ram', department: 'IT' }), 'VALIDATION');
    await expectError(svc.inviteStaff(admin, { email: 'ram@college.ac.in', name: 'Ram', department: 'NOPE' }), 'VALIDATION');
    await expect(svc.inviteStaff(admin, { email: 'Ram@College.ac.in', name: 'Ram', department: 'IT' })).resolves.toEqual({ username: 'ram@college.ac.in', created: true });
  });

  it('demo data loads once, is fully labelled, and clears completely without touching real data', async () => {
    const real = await svc.reportIssue(student(1), { assetId: 'H4-WC-01', issueType: 'NO_WATER' });
    const loaded = await svc.demoData(admin, 'LOAD');
    expect(loaded.issues).toBeGreaterThan(10);
    await expectError(svc.demoData(admin, 'LOAD'), 'CONFLICT');
    expect([...repo.issues.values()].filter((i) => i.id !== real.issue.id).every((i) => i.isDemo)).toBe(true);
    await svc.demoData(admin, 'CLEAR');
    expect([...repo.issues.keys()]).toEqual([real.issue.id]);
    expect([...repo.assets.values()].every((a) => !a.isDemo)).toBe(true);
    expect([...repo.reports.values()].every((r) => !r.isDemo)).toBe(true);
    expect(repo.events.every((e) => !e.isDemo)).toBe(true);
  });
});
