import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { postConfirmation } from './auth/post-confirmation/resource';
import { data } from './data/resource';
import { issueApi, slaSweeper } from './functions/issue-api/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  postConfirmation,
  data,
  storage,
  issueApi,
  slaSweeper,
});

// ── Private evidence bucket: clean up abandoned multipart uploads (avoids silent storage cost) ──
backend.storage.resources.cfnResources.cfnBucket.lifecycleConfiguration = {
  rules: [{ id: 'abort-incomplete-uploads', status: 'Enabled', abortIncompleteMultipartUpload: { daysAfterInitiation: 1 } }],
};

// ── Password policy for campus users ────────────────────────────────────────
backend.auth.resources.cfnResources.cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false,
    requireUppercase: false,
    temporaryPasswordValidityDays: 7,
  },
};
