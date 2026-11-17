# AWS Build Summary: FixLoop

**Region:** ap-south-1 (Mumbai) · **Framework:** AWS Amplify Gen 2 (TypeScript infrastructure-as-code on AWS CDK) · **Plan:** AWS Free Tier

## Architecture at a glance
```
Phone browser (React PWA, EN/HI)
   │  HTTPS (Amplify Hosting / CloudFront)
   ├──► Amazon Cognito ── user pool (email login, groups) + identity pool (guest QR lookups, S3 creds)
   │        └─ post-confirmation Lambda → adds new users to STUDENT
   ├──► AWS AppSync (GraphQL) ── reads: queries + real-time subscriptions
   │        ├─ model resolvers ──► Amazon DynamoDB (Asset, Issue, Report, IssueEvent, IssueLock)
   │        └─ custom mutations ─► AWS Lambda "issue-api" (all business rules)
   │                                   ├─ IAM-signed writes back through AppSync (so subscriptions fire)
   │                                   ├─ Amazon S3 HeadObject (photo validation)
   │                                   └─ Cognito Admin APIs (staff invitations)
   ├──► Amazon S3 (private) ── photo evidence, identity-scoped uploads, pre-signed reads
   └── Amazon EventBridge (hourly) ──► Lambda "sla-sweeper" (escalate, re-score, auto-close)
Amazon CloudWatch ── structured JSON logs, 30-day retention
```

## Services used and why

| Service | What it does in FixLoop | Why this service |
|---|---|---|
| **AWS Amplify Hosting** | Serves the PWA over HTTPS via CDN; CI/CD from GitHub runs `npm test`, then `ampx pipeline-deploy` (backend), then the frontend build | One pipeline for frontend and backend; a broken build never replaces the live version |
| **Amplify Gen 2 (CDK)** | Defines every resource in TypeScript (`amplify/`) | Reproducible infrastructure; another campus can deploy an identical stack |
| **Amazon Cognito** | Email sign-up/sign-in, verification codes, password reset; groups `STUDENT`, `STAFF`, `DEPT_*`, `ADMIN`; identity pool for guest asset lookups and S3 credentials | Managed, secure auth with role claims in every token; 10k MAU free |
| **AWS AppSync** | GraphQL API with per-model authorization; `observeQuery` subscriptions power the live staff queue and admin dashboard | Declarative auth rules, real-time out of the box, typed client [S6] |
| **AWS Lambda** (Node 22, arm64) | `issue-api`: dedupe, priority, state machine, validation, rate limit, staff invites, demo data. `sla-sweeper`: hourly SLA engine. `post-confirmation`: default role | Server-side rules that clients cannot bypass; pay-per-use; arm64 for lower cost |
| **Amazon DynamoDB** (on-demand) | Five tables plus GSIs (by asset, status, department, reporter, issue) | Serverless, millisecond reads, conditional writes for atomic dedupe and race-free status changes |
| **Amazon S3** | Private photo evidence: `reports/{identityId}/…` (student-owned), `repairs/…` (staff) | Fine-grained IAM path rules; pre-signed URLs; lifecycle rule for abandoned uploads |
| **Amazon EventBridge** | Hourly schedule for the SLA sweeper | Escalation must happen even if nobody opens the app |
| **Amazon CloudWatch** | JSON logs from all functions, 30-day retention | Debugging and audit without unbounded storage cost |
| **AWS IAM** | Least-privilege roles generated per function and per user group | Lambda can call only 5 Cognito actions on one pool; S3 write paths per identity |

## Data flow: one report
1. Scan the QR → `/a/H4-WC-01` → `Asset.get` with **guest** credentials (works before sign-in).
2. Sign in → `issuesByAsset` shows active problems → the student picks "No water".
3. Photo compressed on the phone → uploaded directly to S3 under the student's own identity folder.
4. `reportIssue` → Lambda validates (asset, type, text, photo exists/type/size, rate limit) → **conditional put** of `IssueLock` → new Issue (or **confirmation** of the existing one) → priority and SLA computed → audit event written.
5. AppSync subscriptions push the change to the Plumbing staff queue and the admin dashboard **instantly**.
6. Staff ACCEPT → START → RESOLVE (remarks + repair photo, verified server-side) → status `RESOLVED`.
7. The student taps "Yes, it works" → `CLOSED` (verified), or "No" → `REOPENED` with a new SLA.
8. Hourly: EventBridge → sweeper escalates overdue issues and auto-closes unanswered fixes as `CLOSED_UNVERIFIED`.

## Security
- No client can write issues directly; every change goes through Lambda rules, with the caller identity taken from the verified Cognito token.
- Role checks happen twice: AppSync (group rules) and Lambda (department, assignee, reporter, state).
- Private S3, identity-scoped uploads, server-side photo validation, EXIF stripped on device.
- Conditional writes prevent duplicate issues and double-acceptance races.
- Security headers (HSTS, frame-deny, nosniff); no secrets in the repository.
- Full threat model: `AWS_COST_AND_SECURITY.md`.

## Deployment details
- Infrastructure: `amplify/backend.ts` (+ `auth/`, `data/`, `storage/`, `functions/`).
- CI/CD: `amplify.yml`: tests gate every deploy.
- Verification: `scripts/smoke.mjs` checks the live site, SPA deep links, headers, and that the API rejects unauthenticated or forged requests.
- Offline synth check: the CDK app synthesises with no circular dependencies, and generated IAM policies were reviewed for least privilege.
- **Live URL:** *to be filled in after deployment.* See `DEPLOYMENT.md`.

## Cost considerations
Fully serverless, with nothing running 24×7. A one-hostel pilot (300 users, 500 reports/month) is estimated at **≈ $0–1/month**, inside free allowances and Free-tier credits; 10× scale stays under about $5/month (estimates; see `AWS_COST_AND_SECURITY.md`). Monitoring: an AWS Budgets alert at $5/month. Cleanup steps are documented.

## Build process (how we developed it)
1. Researched the competition rules, Indian civic platforms and three open-source campus complaint systems (`COMPETITOR_ANALYSIS.md`).
2. Picked FixLoop with a weighted decision matrix against three alternatives (`IDEA_SELECTION.md`).
3. Wrote the domain rules first, as pure TypeScript (priority, state machine, dedupe, analytics), with **64 unit and service tests**, including mutation checks that confirm the tests fail when a rule is removed.
4. Built the Amplify backend and verified it by offline CDK synthesis (and fixed a nested-stack circular dependency the synth exposed).
5. Built the student, staff and admin experiences in React with Hindi/English throughout.
6. Deployed to AWS and smoke-tested *(status in README).*
