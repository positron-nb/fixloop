#!/usr/bin/env node
/**
 * Confirms which AWS identity your local credentials resolve to.
 * Prints ONLY the account id, the IAM ARN and the region: never keys or tokens.
 *   AWS_PROFILE=fixloop node scripts/whoami.mjs
 */
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

const region = process.env.AWS_REGION ?? 'ap-south-1';
try {
  const id = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
  console.log(JSON.stringify({ account: id.Account, arn: id.Arn, region, profile: process.env.AWS_PROFILE ?? '(default)' }, null, 2));
} catch (e) {
  console.error(`No usable AWS credentials: ${e.name}. Run: npx ampx configure profile --name fixloop`);
  process.exit(1);
}
