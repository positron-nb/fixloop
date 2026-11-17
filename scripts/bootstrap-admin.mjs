#!/usr/bin/env node
/**
 * Creates (or promotes) the first FixLoop administrator.
 * Uses your local AWS credentials (AWS_PROFILE) and the user pool from amplify_outputs.json.
 *
 *   node scripts/bootstrap-admin.mjs --email you@college.ac.in --name "Your Name" [--dept PLUMBING]
 *
 * Cognito emails a temporary password. Nothing secret is printed.
 */
import { readFileSync } from 'node:fs';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const name = (arg('name') ?? 'FixLoop Admin').trim();
const dept = arg('dept')?.toUpperCase();
const DEPTS = ['ELECTRICAL', 'PLUMBING', 'CIVIL', 'HOUSEKEEPING', 'IT'];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (dept && !DEPTS.includes(dept))) {
  console.error(`Usage: node scripts/bootstrap-admin.mjs --email you@college.ac.in --name "Your Name" [--dept ${DEPTS.join('|')}]`);
  process.exit(1);
}

let outputs;
try {
  outputs = JSON.parse(readFileSync(new URL('../amplify_outputs.json', import.meta.url), 'utf8'));
} catch {
  console.error('amplify_outputs.json not found. Run `npx ampx sandbox` or download it from the Amplify console first.');
  process.exit(1);
}
const { user_pool_id: UserPoolId, aws_region: region } = outputs.auth;
const idp = new CognitoIdentityProviderClient({ region });

let username = email;
try {
  const res = await idp.send(
    new AdminCreateUserCommand({
      UserPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );
  username = res.User?.Username ?? email;
  console.log(`Created ${email}. Cognito has emailed a temporary password.`);
} catch (e) {
  if (!(e instanceof UsernameExistsException)) throw e;
  console.log(`${email} already exists; updating groups.`);
}

const groups = ['ADMIN', ...(dept ? ['STAFF', `DEPT_${dept}`] : [])];
for (const GroupName of groups) {
  await idp.send(new AdminAddUserToGroupCommand({ UserPoolId, Username: username, GroupName }));
}
console.log(`Groups: ${groups.join(', ')}. Sign out and back in for new roles to apply.`);
