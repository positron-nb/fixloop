/**
 * AppSync Lambda resolver for FixLoop's custom operations.
 * Identity comes from the verified Cognito token (AppSync passes sub, username and groups);
 * nothing about who the caller is is ever taken from the request arguments.
 */
import type { AppSyncIdentityCognito, AppSyncResolverEvent } from 'aws-lambda';
import { DomainError, encodeError, isDomainError } from '../../../shared/errors';
import type { Actor } from '../../../shared/types';
import { getService, log } from './runtime';
import type { IssueService } from './service';

type Args = Record<string, unknown>;

export function actorFromIdentity(identity: AppSyncResolverEvent<Args>['identity']): Actor {
  const id = identity as AppSyncIdentityCognito | null | undefined;
  if (!id || !id.sub) throw new DomainError('UNAUTHENTICATED', 'Please sign in');
  return { sub: id.sub, username: id.username, groups: id.groups ?? [] };
}

/** Routes a GraphQL field to the service. Exported for tests. */
export async function route(svc: IssueService, field: string, actor: Actor, args: Args): Promise<unknown> {
  switch (field) {
    case 'reportIssue': {
      const r = await svc.reportIssue(actor, args as never);
      return { outcome: r.outcome, issue: r.issue };
    }
    case 'confirmIssue': {
      const r = await svc.confirmIssue(actor, args as never);
      return { outcome: r.outcome, issue: r.issue };
    }
    case 'issueAction':
      return { issue: await svc.issueAction(actor, args as never) };
    case 'myReports':
      return { items: await svc.myReports(actor) };
    case 'inviteStaff':
      return await svc.inviteStaff(actor, args as never);
    case 'listStaff':
      return { items: await svc.listStaff(actor) };
    case 'demoData':
      return await svc.demoData(actor, String(args.action ?? ''));
    default:
      throw new DomainError('VALIDATION', `Unknown operation ${field}`);
  }
}

export const handler = async (event: AppSyncResolverEvent<Args>) => {
  const field = event.info?.fieldName ?? 'unknown';
  const started = Date.now();
  try {
    const actor = actorFromIdentity(event.identity);
    const svc = await getService();
    const result = await route(svc, field, actor, event.arguments ?? {});
    log.info('operation ok', { field, ms: Date.now() - started });
    return JSON.stringify(result);
  } catch (e) {
    if (isDomainError(e)) {
      log.warn('operation rejected', { field, code: e.code, message: e.message, ms: Date.now() - started });
      throw new Error(encodeError(e));
    }
    log.error('operation failed', { field, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined });
    throw new Error(encodeError(new DomainError('INTERNAL', 'Something went wrong. Please try again.')));
  }
};
