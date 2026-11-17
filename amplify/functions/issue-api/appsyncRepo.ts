/**
 * Repo implementation on top of the Amplify Data client (AppSync, IAM-signed).
 * Writes go through AppSync, not straight to DynamoDB, so real-time subscriptions
 * fire and the admin dashboard updates live.
 */
import type { Schema } from '../../data/resource';
import type { generateClient } from 'aws-amplify/data';
import type { AssetRecord, IssueEventRecord, IssueRecord, IssueStatus, ReportRecord } from '../../../shared/types';
import { ACTIVE_STATUSES } from '../../../shared/types';
import { ConflictError, type Repo } from './repo';

type Client = ReturnType<typeof generateClient<Schema>>;
type GqlError = { message?: string; errorType?: string };

const ISSUE_FIELDS = [
  'id', 'assetId', 'assetName', 'assetType', 'building', 'locationLabel', 'issueType', 'department', 'severity', 'status',
  'description', 'photoKeys', 'priorityScore', 'priorityBand', 'priorityBreakdown', 'confirmationCount', 'reopenCount',
  'escalationLevel', 'assetCriticality', 'reportedAt', 'lastOpenedAt', 'acknowledgedAt', 'startedAt', 'resolvedAt',
  'closedAt', 'slaDueAt', 'slaBreached', 'assigneeSub', 'assigneeName', 'resolutionRemarks', 'repairEvidenceKeys',
  'verificationOutcome', 'verificationRating', 'verificationComment', 'declineReason', 'invalidReason', 'submitMs',
  'isDemo', 'createdAt', 'updatedAt',
] as const;

// Full selection set so subscribers (admin dashboard, staff queue) receive complete records.
const UPDATE_ISSUE = /* GraphQL */ `
  mutation UpdateIssue($input: UpdateIssueInput!, $condition: ModelIssueConditionInput) {
    updateIssue(input: $input, condition: $condition) { ${ISSUE_FIELDS.join(' ')} }
  }
`;

const isConditionalFailure = (errors?: GqlError[] | null) =>
  !!errors?.some((e) => (e.errorType ?? '').includes('ConditionalCheckFailed') || (e.message ?? '').includes('conditional request failed'));

function check<T>(res: { data?: T | null; errors?: GqlError[] | null }, what: string): T {
  if (isConditionalFailure(res.errors)) throw new ConflictError(`${what}: conditional check failed`);
  if (res.errors?.length) throw new Error(`${what}: ${res.errors.map((e) => e.message).join('; ')}`);
  return res.data as T;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const parseJson = (v: unknown) => {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v ?? {};
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toIssue(r: any): IssueRecord {
  return {
    ...r,
    photoKeys: strings(r.photoKeys),
    repairEvidenceKeys: strings(r.repairEvidenceKeys),
    priorityBreakdown: parseJson(r.priorityBreakdown),
  } as IssueRecord;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toReport = (r: any): ReportRecord => ({ ...r, photoKeys: strings(r.photoKeys), createdAt: r.submittedAt }) as ReportRecord;

/** Strip undefined (AppSync treats null as "clear", undefined must not be sent). */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function issueInput(patch: Partial<IssueRecord>) {
  const { priorityBreakdown, ...rest } = patch;
  return clean({ ...rest, ...(priorityBreakdown !== undefined ? { priorityBreakdown: JSON.stringify(priorityBreakdown) } : {}) });
}

async function collect<T>(page: (nextToken?: string | null) => Promise<{ data: T[]; nextToken?: string | null; errors?: GqlError[] }>, what: string): Promise<T[]> {
  const out: T[] = [];
  let token: string | null | undefined;
  do {
    const res = await page(token);
    out.push(...check(res, what));
    token = res.nextToken;
  } while (token);
  return out;
}

export class AppSyncRepo implements Repo {
  constructor(private client: Client) {}

  async getAsset(id: string): Promise<AssetRecord | null> {
    const res = await this.client.models.Asset.get({ id });
    const a = check(res, 'getAsset');
    return a ? ({ ...a, status: (a.status as AssetRecord['status']) ?? 'ACTIVE' } as AssetRecord) : null;
  }

  async createAsset(asset: AssetRecord): Promise<AssetRecord> {
    check(await this.client.models.Asset.create(clean(asset)), 'createAsset');
    return asset;
  }

  async listAssets(): Promise<AssetRecord[]> {
    return (await collect((nextToken) => this.client.models.Asset.list({ limit: 500, nextToken }), 'listAssets')) as AssetRecord[];
  }

  async deleteAsset(id: string) {
    check(await this.client.models.Asset.delete({ id }), 'deleteAsset');
  }

  async getIssue(id: string): Promise<IssueRecord | null> {
    if (!id) return null;
    const i = check(await this.client.models.Issue.get({ id }), 'getIssue');
    return i ? toIssue(i) : null;
  }

  async createIssue(issue: IssueRecord): Promise<IssueRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = check(await this.client.models.Issue.create(issueInput(issue) as any), 'createIssue');
    return toIssue(created);
  }

  async updateIssue(id: string, patch: Partial<IssueRecord>, expectedStatus?: IssueStatus): Promise<IssueRecord> {
    const res = (await this.client.graphql({
      query: UPDATE_ISSUE,
      variables: {
        input: { ...issueInput(patch), id },
        ...(expectedStatus ? { condition: { status: { eq: expectedStatus } } } : {}),
      },
    })) as { data?: { updateIssue: unknown }; errors?: GqlError[] };
    try {
      return toIssue(check(res, 'updateIssue')!.updateIssue);
    } catch (e) {
      if (e instanceof ConflictError) throw new ConflictError('Issue changed concurrently');
      throw e;
    }
  }

  async deleteIssue(id: string) {
    check(await this.client.models.Issue.delete({ id }), 'deleteIssue');
  }

  async listIssuesByAsset(assetId: string): Promise<IssueRecord[]> {
    const rows = await collect((nextToken) => this.client.models.Issue.issuesByAsset({ assetId }, { limit: 200, nextToken }), 'issuesByAsset');
    return rows.map(toIssue);
  }

  async listActiveIssues(): Promise<IssueRecord[]> {
    const all: IssueRecord[] = [];
    for (const status of ACTIVE_STATUSES) {
      const rows = await collect((nextToken) => this.client.models.Issue.issuesByStatus({ status }, { limit: 500, nextToken }), 'issuesByStatus');
      all.push(...rows.map(toIssue));
    }
    return all;
  }

  async listAllIssues(): Promise<IssueRecord[]> {
    const rows = await collect((nextToken) => this.client.models.Issue.list({ limit: 500, nextToken }), 'listIssues');
    return rows.map(toIssue);
  }

  async getReport(id: string): Promise<ReportRecord | null> {
    const r = check(await this.client.models.Report.get({ id }), 'getReport');
    return r ? toReport(r) : null;
  }

  async createReport(report: ReportRecord): Promise<ReportRecord> {
    const { createdAt, ...rest } = report;
    const res = await this.client.models.Report.create(clean({ ...rest, submittedAt: createdAt }));
    if (isConditionalFailure(res.errors)) throw new ConflictError('Report already exists');
    check(res, 'createReport');
    return report;
  }

  async updateReport(id: string, patch: Partial<ReportRecord>) {
    const { createdAt, ...rest } = patch;
    void createdAt;
    check(await this.client.models.Report.update(clean({ ...rest, id })), 'updateReport');
  }

  async deleteReport(id: string) {
    check(await this.client.models.Report.delete({ id }), 'deleteReport');
  }

  async listReportsByIssue(issueId: string): Promise<ReportRecord[]> {
    const rows = await collect((nextToken) => this.client.models.Report.reportsByIssue({ issueId }, { limit: 500, nextToken }), 'reportsByIssue');
    return rows.map(toReport);
  }

  async listReportsByReporter(reporterSub: string): Promise<ReportRecord[]> {
    const rows = await collect((nextToken) => this.client.models.Report.reportsByReporter({ reporterSub }, { limit: 500, nextToken }), 'reportsByReporter');
    return rows.map(toReport);
  }

  async createEvent(event: IssueEventRecord) {
    check(await this.client.models.IssueEvent.create(clean(event)), 'createEvent');
  }

  async listEventsByIssue(issueId: string) {
    const rows = await collect((nextToken) => this.client.models.IssueEvent.eventsByIssue({ issueId }, { limit: 500, nextToken }), 'eventsByIssue');
    return rows.map((r) => ({ ...r, evidenceKeys: strings(r.evidenceKeys) }) as IssueEventRecord & { id: string });
  }

  async deleteEvent(id: string) {
    check(await this.client.models.IssueEvent.delete({ id }), 'deleteEvent');
  }

  async claimLock(key: string, issueId: string): Promise<boolean> {
    const res = await this.client.models.IssueLock.create({ id: key, issueId });
    if (isConditionalFailure(res.errors)) return false;
    check(res, 'claimLock');
    return true;
  }

  async getLock(key: string) {
    const l = check(await this.client.models.IssueLock.get({ id: key }), 'getLock');
    return l ? { issueId: l.issueId } : null;
  }

  async releaseLock(key: string) {
    check(await this.client.models.IssueLock.delete({ id: key }), 'releaseLock');
  }
}
