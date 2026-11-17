import { defineFunction } from '@aws-amplify/backend';

/**
 * All write-side business logic (report, confirm, workflow actions, admin tools).
 * Lives in its own (function) stack: auth grants it Cognito permissions and data uses it as a resolver.
 * arm64 is cheaper per GB-second than x86 and well inside the Lambda free tier.
 */
export const issueApi = defineFunction({
  name: 'issue-api',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 22,
  architecture: 'arm64',
  logging: { format: 'json', level: 'info', retention: '1 month' },
});

/** Hourly SLA sweep: escalates missed targets, re-scores waiting issues, auto-closes unverified fixes. */
export const slaSweeper = defineFunction({
  name: 'sla-sweeper',
  entry: './sweeper.ts',
  timeoutSeconds: 120,
  memoryMB: 512,
  runtime: 22,
  architecture: 'arm64',
  schedule: 'every 1h',
  logging: { format: 'json', level: 'info', retention: '1 month' },
});
