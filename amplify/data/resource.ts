import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { issueApi, slaSweeper } from '../functions/issue-api/resource';

/**
 * Data model (AWS AppSync + Amazon DynamoDB).
 *
 * Authorization principle: clients may READ what they need, but every WRITE to issues,
 * reports and the audit timeline goes through the issue-api Lambda (custom mutations),
 * where workflow rules and role checks are enforced. See docs/DATABASE_SCHEMA.md.
 */
const schema = a
  .schema({
    // ── Physical assets (QR identity) ──────────────────────────────────────
    Asset: a
      .model({
        id: a.id().required(), // human-readable code printed on the QR label, e.g. H4-WC-01
        name: a.string().required(),
        nameHi: a.string(),
        assetType: a.string().required(),
        building: a.string().required(),
        floor: a.string(),
        locationLabel: a.string().required(),
        locationLabelHi: a.string(),
        criticality: a.integer().required(),
        status: a.string().required(), // ACTIVE | RETIRED
        installedOn: a.date(),
        isDemo: a.boolean().required(),
      })
      .authorization((allow) => [
        allow.guest().to(['read']), // a scanned QR resolves to its asset before sign-in
        allow.authenticated().to(['read']),
        allow.group('ADMIN'),
      ]),

    // ── Issues (one per distinct fault on an asset) ─────────────────────────
    Issue: a
      .model({
        assetId: a.string().required(),
        assetName: a.string().required(),
        assetType: a.string().required(),
        building: a.string().required(),
        locationLabel: a.string().required(),
        issueType: a.string().required(),
        department: a.string().required(),
        severity: a.string().required(),
        status: a.string().required(),
        description: a.string(),
        photoKeys: a.string().array(),
        priorityScore: a.integer().required(),
        priorityBand: a.string().required(),
        priorityBreakdown: a.json(),
        confirmationCount: a.integer().required(),
        reopenCount: a.integer().required(),
        escalationLevel: a.integer().required(),
        assetCriticality: a.integer().required(),
        reportedAt: a.datetime().required(),
        lastOpenedAt: a.datetime().required(),
        acknowledgedAt: a.datetime(),
        startedAt: a.datetime(),
        resolvedAt: a.datetime(),
        closedAt: a.datetime(),
        slaDueAt: a.datetime().required(),
        slaBreached: a.boolean().required(),
        assigneeSub: a.string(),
        assigneeName: a.string(),
        resolutionRemarks: a.string(),
        repairEvidenceKeys: a.string().array(),
        verificationOutcome: a.string(),
        verificationRating: a.integer(),
        verificationComment: a.string(),
        declineReason: a.string(),
        invalidReason: a.string(),
        submitMs: a.integer(),
        isDemo: a.boolean().required(),
      })
      .secondaryIndexes((index) => [
        index('assetId').sortKeys(['reportedAt']).queryField('issuesByAsset'),
        index('status').sortKeys(['reportedAt']).queryField('issuesByStatus'),
        index('department').sortKeys(['reportedAt']).queryField('issuesByDepartment'),
      ])
      // Issues hold no reporter identity, so every signed-in campus user can see them (transparency).
      .authorization((allow) => [allow.authenticated().to(['read'])]),

    // ── Reports (one per person per issue: original or confirmation) ───────
    Report: a
      .model({
        id: a.id().required(), // `${issueId}#${reporterSub}` — enforces one report per person
        issueId: a.string().required(),
        assetId: a.string().required(),
        reporterSub: a.string().required(),
        kind: a.string().required(), // ORIGINAL | CONFIRMATION
        note: a.string(),
        photoKeys: a.string().array(),
        submitMs: a.integer(),
        submittedAt: a.datetime().required(),
        verification: a.string(),
        verifiedAt: a.datetime(),
        isDemo: a.boolean().required(),
      })
      .secondaryIndexes((index) => [
        index('issueId').queryField('reportsByIssue'),
        index('reporterSub').sortKeys(['submittedAt']).queryField('reportsByReporter'),
      ])
      // Contains reporter identity: only admins may read it directly; students use myReports.
      .authorization((allow) => [allow.group('ADMIN').to(['read'])]),

    // ── Immutable audit timeline ────────────────────────────────────────────
    IssueEvent: a
      .model({
        issueId: a.string().required(),
        type: a.string().required(),
        fromStatus: a.string(),
        toStatus: a.string(),
        actorRole: a.string().required(),
        actorName: a.string(), // staff/admin only; never a student
        note: a.string(),
        evidenceKeys: a.string().array(),
        at: a.datetime().required(),
        isDemo: a.boolean().required(),
      })
      .secondaryIndexes((index) => [index('issueId').sortKeys(['at']).queryField('eventsByIssue')])
      .authorization((allow) => [allow.authenticated().to(['read'])]),

    // ── Dedupe lock: one active issue per (asset, issue type) ───────────────
    IssueLock: a
      .model({
        id: a.id().required(), // `${assetId}#${issueType}`
        issueId: a.string().required(),
      })
      .authorization((allow) => [allow.group('ADMIN').to(['read'])]),

    // ── Custom operations (all handled by the issue-api Lambda) ─────────────
    reportIssue: a
      .mutation()
      .arguments({
        assetId: a.string().required(),
        issueType: a.string().required(),
        safetyHazard: a.boolean(),
        description: a.string(),
        photoKeys: a.string().array(),
        submitMs: a.integer(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(issueApi)),

    confirmIssue: a
      .mutation()
      .arguments({
        issueId: a.string().required(),
        note: a.string(),
        photoKeys: a.string().array(),
        submitMs: a.integer(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(issueApi)),

    issueAction: a
      .mutation()
      .arguments({
        issueId: a.string().required(),
        action: a.string().required(),
        note: a.string(),
        evidenceKeys: a.string().array(),
        department: a.string(),
        rating: a.integer(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(issueApi)),

    myReports: a
      .query()
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(issueApi)),

    inviteStaff: a
      .mutation()
      .arguments({
        email: a.string().required(),
        name: a.string().required(),
        department: a.string(),
        makeAdmin: a.boolean(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(issueApi)),

    listStaff: a
      .query()
      .returns(a.json())
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(issueApi)),

    demoData: a
      .mutation()
      .arguments({ action: a.string().required() })
      .returns(a.json())
      .authorization((allow) => [allow.group('ADMIN')])
      .handler(a.handler.function(issueApi)),
  })
  // The Lambda functions talk to AppSync with IAM; no client can.
  .authorization((allow) => [allow.resource(issueApi), allow.resource(slaSweeper)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
