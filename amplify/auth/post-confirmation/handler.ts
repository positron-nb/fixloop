import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // Only self sign-ups. Admin-created staff confirm through "ConfirmForgotPassword"/first sign-in flows.
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;
  await client.send(
    new AdminAddUserToGroupCommand({
      GroupName: 'STUDENT',
      Username: event.userName,
      UserPoolId: event.userPoolId,
    }),
  );
  console.log(JSON.stringify({ level: 'info', msg: 'user added to STUDENT group', userPoolId: event.userPoolId }));
  return event;
};
