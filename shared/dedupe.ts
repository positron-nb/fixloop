/**
 * Duplicate consolidation.
 *
 * Rule: on the same physical asset, an active issue of the same issue type IS the same problem.
 * A new report becomes a confirmation of that issue: it adds independent evidence and raises
 * priority, instead of creating a duplicate ticket.
 *
 * Free-form "Something else" reports are never auto-merged, because their meaning differs.
 * The reporter is shown the asset's active issues and can confirm one manually.
 */
import type { IssueType } from './catalog';
import { isActive, type IssueRecord } from './types';

export const lockKey = (assetId: string, issueTypeCode: string) => `${assetId}#${issueTypeCode}`;

export const reportId = (issueId: string, reporterSub: string) => `${issueId}#${reporterSub}`;

export function findDuplicate(issuesOnAsset: IssueRecord[], assetId: string, issueType: IssueType): IssueRecord | undefined {
  if (issueType.freeform) return undefined;
  return issuesOnAsset
    .filter((i) => i.assetId === assetId && i.issueType === issueType.code && isActive(i.status))
    .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt))[0];
}

/** Active issues on an asset, shown before reporting ("Is it one of these?"), most urgent first. */
export function activeSuggestions(issuesOnAsset: IssueRecord[]): IssueRecord[] {
  return issuesOnAsset.filter((i) => isActive(i.status)).sort((a, b) => b.priorityScore - a.priorityScore);
}

export type ReportOutcome =
  | 'CREATED' // a new issue was opened
  | 'CONFIRMED' // merged into an existing active issue as an independent confirmation
  | 'ALREADY_REPORTED' // this person already reported/confirmed this issue: nothing changed
  | 'REOPENED'; // the issue was awaiting verification; a fresh report means the fix did not hold
