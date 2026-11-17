import { defineStorage } from '@aws-amplify/backend';
import { issueApi } from '../functions/issue-api/resource';

/**
 * Private Amazon S3 bucket for photo evidence. Nothing is public:
 * - reports/{identityId}/*  : a student can write only into their own folder; signed-in users can read
 *                             (so staff and co-reporters can see the problem).
 * - repairs/*               : only STAFF can upload repair evidence; signed-in users can read
 *                             (so the reporter can verify the fix).
 * Reads use short-lived pre-signed URLs. The issue-api Lambda can read object metadata
 * to verify that a referenced photo exists, is an image and is at most 5 MB.
 */
export const storage = defineStorage({
  name: 'fixloopEvidence',
  access: (allow) => ({
    'reports/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
      allow.resource(issueApi).to(['read']),
    ],
    'repairs/*': [
      allow.groups(['STAFF']).to(['read', 'write']),
      allow.authenticated.to(['read']),
      allow.resource(issueApi).to(['read']),
    ],
  }),
});
