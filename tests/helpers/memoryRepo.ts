import { ConflictError, type Directory, type PhotoInspector, type Repo } from '../../amplify/functions/issue-api/repo';
import { ACTIVE_STATUSES, type AssetRecord, type IssueEventRecord, type IssueRecord, type IssueStatus, type ReportRecord } from '../../shared/types';

/** In-memory Repo with the same semantics as the AppSync implementation (conditional writes included). */
export class MemoryRepo implements Repo {
  assets = new Map<string, AssetRecord>();
  issues = new Map<string, IssueRecord>();
  reports = new Map<string, ReportRecord>();
  events: (IssueEventRecord & { id: string })[] = [];
  locks = new Map<string, string>();
  private eventSeq = 0;

  async getAsset(id: string) {
    return structuredClone(this.assets.get(id) ?? null);
  }
  async createAsset(a: AssetRecord) {
    if (this.assets.has(a.id)) throw new ConflictError();
    this.assets.set(a.id, structuredClone(a));
    return a;
  }
  async listAssets() {
    return [...this.assets.values()].map((a) => structuredClone(a));
  }
  async deleteAsset(id: string) {
    this.assets.delete(id);
  }
  async getIssue(id: string) {
    return structuredClone(this.issues.get(id) ?? null);
  }
  async createIssue(i: IssueRecord) {
    if (this.issues.has(i.id)) throw new ConflictError();
    this.issues.set(i.id, structuredClone(i));
    return structuredClone(i);
  }
  async updateIssue(id: string, patch: Partial<IssueRecord>, expectedStatus?: IssueStatus) {
    const cur = this.issues.get(id);
    if (!cur) throw new Error('not found');
    if (expectedStatus && cur.status !== expectedStatus) throw new ConflictError('Issue changed concurrently');
    const next = { ...cur, ...structuredClone(patch) } as IssueRecord;
    this.issues.set(id, next);
    return structuredClone(next);
  }
  async deleteIssue(id: string) {
    this.issues.delete(id);
  }
  async listIssuesByAsset(assetId: string) {
    return [...this.issues.values()].filter((i) => i.assetId === assetId).map((i) => structuredClone(i));
  }
  async listActiveIssues() {
    return [...this.issues.values()].filter((i) => ACTIVE_STATUSES.includes(i.status)).map((i) => structuredClone(i));
  }
  async listAllIssues() {
    return [...this.issues.values()].map((i) => structuredClone(i));
  }
  async getReport(id: string) {
    return structuredClone(this.reports.get(id) ?? null);
  }
  async createReport(r: ReportRecord) {
    if (this.reports.has(r.id)) throw new ConflictError('Report already exists');
    this.reports.set(r.id, structuredClone(r));
    return r;
  }
  async updateReport(id: string, patch: Partial<ReportRecord>) {
    const cur = this.reports.get(id);
    if (cur) this.reports.set(id, { ...cur, ...patch });
  }
  async deleteReport(id: string) {
    this.reports.delete(id);
  }
  async listReportsByIssue(issueId: string) {
    return [...this.reports.values()].filter((r) => r.issueId === issueId);
  }
  async listReportsByReporter(sub: string) {
    return [...this.reports.values()].filter((r) => r.reporterSub === sub);
  }
  async createEvent(e: IssueEventRecord) {
    this.events.push({ ...structuredClone(e), id: `ev-${++this.eventSeq}` });
  }
  async listEventsByIssue(issueId: string) {
    return this.events.filter((e) => e.issueId === issueId);
  }
  async deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
  }
  async claimLock(key: string, issueId: string) {
    if (this.locks.has(key)) return false;
    this.locks.set(key, issueId);
    return true;
  }
  async getLock(key: string) {
    const issueId = this.locks.get(key);
    return issueId ? { issueId } : null;
  }
  async releaseLock(key: string) {
    this.locks.delete(key);
  }
}

export class FakePhotos implements PhotoInspector {
  objects = new Map<string, { size: number; contentType: string }>();
  put(key: string, size = 200_000, contentType = 'image/jpeg') {
    this.objects.set(key, { size, contentType });
    return key;
  }
  async inspect(key: string) {
    const o = this.objects.get(key);
    return o ? { exists: true, ...o } : { exists: false };
  }
}

export class FakeDirectory implements Directory {
  invited: { email: string; name: string; department: string; makeAdmin: boolean }[] = [];
  async displayName(username: string) {
    return `Name of ${username}`;
  }
  async inviteStaff(input: { email: string; name: string; department: string; makeAdmin: boolean }) {
    this.invited.push(input);
    return { username: input.email, created: true };
  }
  async listStaff() {
    return this.invited.map((i) => ({ username: i.email, email: i.email, name: i.name, groups: ['STAFF'] }));
  }
}

/** A controllable clock. */
export class Clock {
  constructor(public t = new Date('2026-11-20T09:00:00.000Z')) {}
  now = () => new Date(this.t);
  advanceHours(h: number) {
    this.t = new Date(this.t.getTime() + h * 3_600_000);
  }
}
