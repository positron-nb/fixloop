/**
 * Typed API layer over the Amplify Data client. Every function here talks to the real
 * AppSync API. There is no mock fallback.
 */
import './amplify';
import { generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { decodeError, type DomainErrorCode } from '../../shared/errors';
import type { ReportOutcome } from '../../shared/dedupe';
import { parseJson, toAsset, toEvent, toIssue } from '../../shared/records';
import type { AssetRecord, IssueEventRecord, IssueRecord, ReportRecord } from '../../shared/types';
import type { IssueAction } from '../../shared/workflow';

let _client: ReturnType<typeof generateClient<Schema>> | undefined;
const client = () => (_client ??= generateClient<Schema>());

export class ApiError extends Error {
  code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type Res<T> = { data?: T | null; errors?: readonly { message?: string }[] | null };

function unwrap<T>(res: Res<T>): T {
  if (res.errors?.length) {
    const first = res.errors[0]?.message ?? '';
    const d = decodeError(first);
    // AppSync auth failures come back as "Not Authorized to access …"
    if (/not authorized|unauthorized/i.test(first)) throw new ApiError('FORBIDDEN', 'You do not have access to this.');
    throw new ApiError(d.code, d.message);
  }
  return res.data as T;
}

const json = <T>(v: unknown): T => parseJson<T>(v, {} as T);

async function call<T>(fn: () => Promise<Res<T>>): Promise<T> {
  try {
    return unwrap(await fn());
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const err = e as { errors?: { message?: string }[]; message?: string; name?: string };
    if (err?.errors?.length) return unwrap({ errors: err.errors });
    if (err?.name === 'UserUnAuthenticatedException' || err?.name === 'NoValidAuthTokens') throw new ApiError('UNAUTHENTICATED', 'Please sign in');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('INTERNAL', 'You are offline');
    throw new ApiError('INTERNAL', err?.message || 'Network error');
  }
}

async function all<T>(page: (nextToken?: string | null) => Promise<Res<T[]> & { nextToken?: string | null }>): Promise<T[]> {
  const out: T[] = [];
  let token: string | null | undefined;
  do {
    const res = await page(token);
    out.push(...unwrap(res));
    token = res.nextToken;
  } while (token);
  return out;
}

// ── Assets ───────────────────────────────────────────────────────────────

/** Works signed-out too (guest access through the Cognito identity pool). */
export async function getAsset(id: string, signedIn: boolean): Promise<AssetRecord | null> {
  const a = await call(() => client().models.Asset.get({ id }, { authMode: signedIn ? 'userPool' : 'identityPool' }));
  return a ? toAsset(a) : null;
}

export async function listAssets(): Promise<AssetRecord[]> {
  return (await all((nextToken) => client().models.Asset.list({ limit: 500, nextToken }))).map(toAsset);
}

export async function saveAsset(asset: AssetRecord, isNew: boolean): Promise<void> {
  const input = { ...asset, nameHi: asset.nameHi || null, floor: asset.floor || null, locationLabelHi: asset.locationLabelHi || null, installedOn: asset.installedOn || null };
  if (isNew) await call(() => client().models.Asset.create(input));
  else await call(() => client().models.Asset.update(input));
}

export async function deleteAsset(id: string): Promise<void> {
  await call(() => client().models.Asset.delete({ id }));
}

// ── Issues ───────────────────────────────────────────────────────────────

export async function issuesByAsset(assetId: string): Promise<IssueRecord[]> {
  const rows = await all((nextToken) => client().models.Issue.issuesByAsset({ assetId }, { limit: 200, nextToken, sortDirection: 'DESC' }));
  return rows.map(toIssue);
}

export async function getIssue(id: string): Promise<IssueRecord | null> {
  const r = await call(() => client().models.Issue.get({ id }));
  return r ? toIssue(r) : null;
}

export async function eventsByIssue(issueId: string): Promise<(IssueEventRecord & { id: string })[]> {
  const rows = await all((nextToken) => client().models.IssueEvent.eventsByIssue({ issueId }, { limit: 200, nextToken }));
  return rows.map(toEvent);
}

/** Live list of all issues (initial sync + AppSync subscriptions). Returns an unsubscribe function. */
export function observeIssues(onChange: (issues: IssueRecord[], synced: boolean) => void, onError: (e: ApiError) => void): () => void {
  const sub = client()
    .models.Issue.observeQuery()
    .subscribe({
      next: ({ items, isSynced }) => onChange(items.map(toIssue), isSynced),
      error: (e: unknown) => {
        try {
          unwrap({ errors: (e as { errors?: { message?: string }[] })?.errors ?? [{ message: String(e) }] });
        } catch (err) {
          onError(err as ApiError);
        }
      },
    });
  return () => sub.unsubscribe();
}

export async function listAllIssues(): Promise<IssueRecord[]> {
  return (await all((nextToken) => client().models.Issue.list({ limit: 500, nextToken }))).map(toIssue);
}

// ── Custom operations (Lambda) ───────────────────────────────────────────

export interface ReportResponse {
  outcome: ReportOutcome;
  issue: IssueRecord;
}

export async function reportIssue(input: {
  assetId: string;
  issueType: string;
  safetyHazard?: boolean;
  description?: string;
  photoKeys?: string[];
  submitMs?: number;
}): Promise<ReportResponse> {
  const r = json<ReportResponse>(await call(() => client().mutations.reportIssue(input)));
  return { ...r, issue: toIssue(r.issue) };
}

export async function confirmIssue(input: { issueId: string; note?: string; photoKeys?: string[]; submitMs?: number }): Promise<ReportResponse> {
  const r = json<ReportResponse>(await call(() => client().mutations.confirmIssue(input)));
  return { ...r, issue: toIssue(r.issue) };
}

export async function issueAction(input: {
  issueId: string;
  action: IssueAction;
  note?: string;
  evidenceKeys?: string[];
  department?: string;
  rating?: number;
}): Promise<IssueRecord> {
  const r = json<{ issue: IssueRecord }>(await call(() => client().mutations.issueAction(input)));
  return toIssue(r.issue);
}

export interface MyReport {
  report: ReportRecord;
  issue: IssueRecord;
}

export async function myReports(): Promise<MyReport[]> {
  const r = json<{ items: MyReport[] }>(await call(() => client().queries.myReports()));
  return (r.items ?? []).map((x) => ({ report: x.report, issue: toIssue(x.issue) }));
}

export interface StaffMember {
  username: string;
  email?: string;
  name?: string;
  groups: string[];
  status?: string;
}

export async function listStaff(): Promise<StaffMember[]> {
  return json<{ items: StaffMember[] }>(await call(() => client().queries.listStaff())).items ?? [];
}

export async function inviteStaff(input: { email: string; name: string; department?: string; makeAdmin?: boolean }) {
  return json<{ username: string; created: boolean }>(await call(() => client().mutations.inviteStaff(input)));
}

export async function demoData(action: 'LOAD' | 'CLEAR') {
  return json<{ assets: number; issues: number }>(await call(() => client().mutations.demoData({ action })));
}

// ── Photos (private S3) ──────────────────────────────────────────────────

const MAX_EDGE = 1600;

/** Downscale and re-encode to JPEG on the device: saves mobile data and strips EXIF location. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new ApiError('VALIDATION', 'Please choose an image');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
  return blob ?? file;
}

const fileName = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

export async function uploadPhoto(file: File, kind: 'report' | 'repair'): Promise<string> {
  const blob = await compressImage(file);
  if (blob.size > 5 * 1024 * 1024) throw new ApiError('VALIDATION', 'Photo is larger than 5 MB');
  const name = fileName();
  const result = await uploadData({
    path: kind === 'report' ? ({ identityId }) => `reports/${identityId}/${name}` : `repairs/${name}`,
    data: blob,
    options: { contentType: 'image/jpeg' },
  }).result;
  return result.path;
}

const urlCache = new Map<string, { url: string; exp: number }>();

export async function photoUrl(path: string): Promise<string> {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const { url, expiresAt } = await getUrl({ path, options: { expiresIn: 900 } });
  urlCache.set(path, { url: url.toString(), exp: expiresAt.getTime() });
  return url.toString();
}
