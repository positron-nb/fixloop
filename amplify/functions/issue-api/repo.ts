import type { AssetRecord, IssueEventRecord, IssueRecord, ReportRecord } from '../../../shared/types';

/**
 * Persistence port used by the issue service. Production uses the AppSync-backed
 * implementation (appsyncRepo.ts); tests use an in-memory implementation.
 */
export interface Repo {
  getAsset(id: string): Promise<AssetRecord | null>;
  getIssue(id: string): Promise<IssueRecord | null>;
  createIssue(issue: IssueRecord): Promise<IssueRecord>;
  /**
   * Applies a partial update and returns the full updated record.
   * If `expectedStatus` is given, the write must fail with ConflictError when the stored
   * status differs (optimistic concurrency: e.g. two staff accepting at once).
   */
  updateIssue(id: string, patch: Partial<IssueRecord>, expectedStatus?: IssueRecord['status']): Promise<IssueRecord>;
  listIssuesByAsset(assetId: string): Promise<IssueRecord[]>;
  /** Issues in any active status (used by the scheduled SLA sweeper). */
  listActiveIssues(): Promise<IssueRecord[]>;
  listAllIssues(): Promise<IssueRecord[]>;

  getReport(id: string): Promise<ReportRecord | null>;
  /** Must throw ConflictError if a report with the same id already exists. */
  createReport(report: ReportRecord): Promise<ReportRecord>;
  updateReport(id: string, patch: Partial<ReportRecord>): Promise<void>;
  listReportsByIssue(issueId: string): Promise<ReportRecord[]>;
  listReportsByReporter(reporterSub: string): Promise<ReportRecord[]>;

  createEvent(event: IssueEventRecord): Promise<void>;

  /** Atomically claim the dedupe lock. Returns false if someone else holds it. */
  claimLock(key: string, issueId: string): Promise<boolean>;
  getLock(key: string): Promise<{ issueId: string } | null>;
  releaseLock(key: string): Promise<void>;

  createAsset(asset: AssetRecord): Promise<AssetRecord>;
  listAssets(): Promise<AssetRecord[]>;
  deleteAsset(id: string): Promise<void>;
  deleteIssue(id: string): Promise<void>;
  deleteReport(id: string): Promise<void>;
  listEventsByIssue(issueId: string): Promise<(IssueEventRecord & { id: string })[]>;
  deleteEvent(id: string): Promise<void>;
}

export class ConflictError extends Error {
  constructor(message = 'Already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Optional check that an uploaded photo really exists in S3 and is an allowed image. */
export interface PhotoInspector {
  inspect(key: string): Promise<{ exists: boolean; size?: number; contentType?: string }>;
}

/** Looks up a staff member's display name (Cognito attribute), cached per container. */
export interface Directory {
  displayName(username: string): Promise<string | undefined>;
  inviteStaff(input: { email: string; name: string; department: string; makeAdmin: boolean }): Promise<{ username: string; created: boolean }>;
  listStaff(): Promise<{ username: string; email?: string; name?: string; groups: string[]; status?: string }[]>;
}
