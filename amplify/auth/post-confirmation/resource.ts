import { defineFunction } from '@aws-amplify/backend';

/** Adds every newly confirmed self-sign-up to the STUDENT group (least privilege by default). */
export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  resourceGroupName: 'auth',
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 22,
  architecture: 'arm64',
  logging: { format: 'json', level: 'info', retention: '1 month' },
});
