/** Wires the issue service to real AWS clients inside Lambda (shared by both functions). */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];
import type { Schema } from '../../data/resource';
import { AppSyncRepo } from './appsyncRepo';
import { CognitoDirectory, S3PhotoInspector } from './adapters';
import { IssueService, type Logger } from './service';

export const log: Logger = {
  info: (msg, ctx) => console.log(JSON.stringify({ level: 'INFO', msg, ...ctx })),
  warn: (msg, ctx) => console.warn(JSON.stringify({ level: 'WARN', msg, ...ctx })),
  error: (msg, ctx) => console.error(JSON.stringify({ level: 'ERROR', msg, ...ctx })),
};

let servicePromise: Promise<IssueService> | undefined;

/** Lazily builds one service per Lambda container (reused across warm invocations). */
export function getService(): Promise<IssueService> {
  servicePromise ??= (async () => {
    const env = process.env as unknown as DataClientEnv;
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    const client = generateClient<Schema>();
    const bucket = process.env.fixloopEvidence_BUCKET_NAME;
    const userPoolId = process.env.amplifyAuth_USERPOOL_ID;
    return new IssueService({
      repo: new AppSyncRepo(client),
      photos: bucket ? new S3PhotoInspector(bucket) : undefined,
      directory: userPoolId ? new CognitoDirectory(userPoolId) : undefined,
      log,
    });
  })();
  return servicePromise;
}
