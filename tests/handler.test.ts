/**
 * Lambda resolver boundary: identity extraction, routing and error encoding.
 * The AWS runtime is mocked with the in-memory service so no AWS calls happen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueService } from '../amplify/functions/issue-api/service';
import { Clock, FakeDirectory, MemoryRepo } from './helpers/memoryRepo';

const state: { svc?: IssueService; repo?: MemoryRepo } = {};

vi.mock('../amplify/functions/issue-api/runtime', () => ({
  getService: async () => state.svc,
  log: { info: () => {}, warn: () => {}, error: () => {} },
}));

const { handler, actorFromIdentity } = await import('../amplify/functions/issue-api/handler');

const event = (fieldName: string, args: Record<string, unknown>, identity: unknown) =>
  ({ info: { fieldName }, arguments: args, identity }) as never;

const studentIdentity = { sub: 'stu-1', username: 'stu-1', groups: ['STUDENT'], claims: {} };

beforeEach(async () => {
  state.repo = new MemoryRepo();
  state.svc = new IssueService({ repo: state.repo, directory: new FakeDirectory(), now: new Clock().now });
  await state.repo.createAsset({ id: 'H4-WC-01', name: 'Cooler', assetType: 'WATER_COOLER', building: 'H4', locationLabel: 'GF', criticality: 2, status: 'ACTIVE', isDemo: false });
});

describe('issue-api handler', () => {
  it('derives the actor from the verified token, never from arguments', () => {
    expect(actorFromIdentity({ sub: 'x', username: 'u', groups: null } as never)).toEqual({ sub: 'x', username: 'u', groups: [] });
    expect(() => actorFromIdentity(null as never)).toThrow('Please sign in');
    expect(() => actorFromIdentity({ accountId: '123', cognitoIdentityPoolId: 'pool' } as never)).toThrow('Please sign in'); // IAM/guest caller
  });

  it('returns a JSON payload for a successful report', async () => {
    const res = await handler(event('reportIssue', { assetId: 'H4-WC-01', issueType: 'NO_WATER', reporterSub: 'spoofed' }, studentIdentity));
    const body = JSON.parse(res as string);
    expect(body.outcome).toBe('CREATED');
    expect(body.issue.department).toBe('PLUMBING');
    const report = [...state.repo!.reports.values()][0];
    expect(report.reporterSub).toBe('stu-1'); // the spoofed argument is ignored
  });

  it('encodes domain errors as "CODE: message" and hides internal errors', async () => {
    await expect(handler(event('reportIssue', { assetId: 'NOPE-1', issueType: 'NO_WATER' }, studentIdentity))).rejects.toThrow(/^NOT_FOUND: /);
    await expect(handler(event('demoData', { action: 'LOAD' }, studentIdentity))).rejects.toThrow(/^FORBIDDEN: /);
    await expect(handler(event('reportIssue', { assetId: 'H4-WC-01', issueType: 'NO_WATER' }, null))).rejects.toThrow(/^UNAUTHENTICATED: /);
    await expect(handler(event('dropTables', {}, studentIdentity))).rejects.toThrow(/^VALIDATION: /);

    state.repo!.getAsset = async () => {
      throw new Error('DynamoDB exploded: arn:aws:dynamodb:secret-detail');
    };
    const err = await handler(event('reportIssue', { assetId: 'H4-WC-01', issueType: 'NO_WATER' }, studentIdentity)).catch((e: Error) => e);
    expect((err as Error).message).toBe('INTERNAL: Something went wrong. Please try again.');
    expect((err as Error).message).not.toContain('arn:aws');
  });
});
