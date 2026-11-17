import { defineAuth } from '@aws-amplify/backend';
import { ALL_GROUPS } from '../../shared/catalog';
import { postConfirmation } from './post-confirmation/resource';
import { issueApi } from '../functions/issue-api/resource';

/**
 * Amazon Cognito user pool.
 * - Email + password sign-in with email verification codes.
 * - Groups: ADMIN, STAFF, STUDENT plus one DEPT_* group per maintenance department.
 *   New self-sign-ups become STUDENT (post-confirmation trigger). Staff/admins are invited
 *   by an administrator through the issue-api function (AdminCreateUser).
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Your FixLoop verification code',
      verificationEmailBody: (createCode) =>
        `Your FixLoop verification code is ${createCode()}. / आपका FixLoop सत्यापन कोड ${createCode()} है।`,
      userInvitation: {
        emailSubject: 'You have been invited to FixLoop',
        emailBody: (user, code) =>
          `You have been added to FixLoop as maintenance staff. Sign in with ${user()} and the temporary password ${code()}. You will be asked to set a new password.`,
      },
    },
  },
  userAttributes: {
    fullname: { required: false, mutable: true },
  },
  groups: ALL_GROUPS,
  triggers: { postConfirmation },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
    allow.resource(issueApi).to(['createUser', 'addUserToGroup', 'getUser', 'listUsersInGroup', 'listGroupsForUser']),
  ],
});
