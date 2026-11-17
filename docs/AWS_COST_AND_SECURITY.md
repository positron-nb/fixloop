# AWS Cost, Security and Cleanup

## 1. Account plan check (do this first)

New AWS accounts (created on or after 15 Jul 2025) choose a **Free** or **Paid** plan [S3][S5].

| Check | Why it matters |
|---|---|
| **Which plan is the account on?** (Billing console → Free Tier / Credits) | The Free plan never charges you, but it **closes 6 months after sign-up or when credits run out**, whichever is first [S5]. The account must stay alive until **17 Dec 2026** (Demo Day) |
| **Account creation date** | On the Free plan, an account created before mid-June 2026 could expire before Demo Day |
| **Do NOT enable IAM Identity Center or AWS Organizations** | Neither is supported on the Free plan, and joining Organizations **automatically upgrades the account to Paid** [S4][S5]. Use an IAM user + access key instead (see `DEPLOYMENT.md`) |

Every service FixLoop uses appears on AWS's Free-plan eligible list: Amplify, AppSync, Cognito, DynamoDB, Lambda, S3, CloudWatch, CloudFormation, EventBridge, Budgets [S4].

## 2. Expected cost (estimate, not a measurement)

Assumptions for a one-hostel pilot: **300 users, 500 reports/month, 30 assets, 5 staff, ~50 deploys/month.**

| Service | Usage estimate per month | Free allowance | Expected cost |
|---|---|---|---|
| Cognito | ≤ 300 MAU | 10,000 MAU (Lite/Essentials, no expiry) [S11] | $0 |
| AppSync | ~60k operations + ~20k real-time messages | 250k ops + 250k updates (first 12 months) [S10] | $0 (≈ $0.25 if beyond the free tier) |
| Lambda | ~6k invocations + 720 sweeps, < 2k GB-s | 1M requests + 400k GB-s per month (always free) | $0 |
| DynamoDB (on-demand) | < 100k writes, < 1M reads, < 100 MB | 25 GB storage always free; requests billed on demand | < $0.30 |
| S3 | ~150 MB photos, ~10k requests | small | < $0.05 |
| Amplify Hosting | ~250 build minutes, < 5 GB transfer | 1,000 build min, 15 GB transfer, 5 GB storage [S9] | $0 |
| CloudWatch Logs | < 0.5 GB ingested, 30-day retention | 5 GB ingestion | $0 |
| EventBridge schedule | 720 invocations | scheduled rules are free | $0 |
| **Total** | | | **≈ $0–1 / month**, covered by Free-tier credits |

At 10× scale (one large campus, ~5,000 reports/month) the estimate stays under about **$5/month**. These are planning estimates. **Verify actual spend in Cost Explorer**; we don't claim measured costs until the pilot runs.

**Why it is cheap by design:** no always-on servers or databases (no EC2/RDS/NAT gateway), arm64 Lambda, images compressed on the phone, log retention capped at 30 days, and abandoned S3 multipart uploads auto-deleted after 1 day.

## 3. Cost monitoring (account changes: the account owner does these)

1. **AWS Budgets → Create budget → "Monthly cost budget"**: $5, with email alerts at 50%, 80% and 100% of actual spend and 100% of forecast. Creating a budget is also one of the Free-tier onboarding activities that earns extra credits [S3].
2. **Billing → Free Tier**: check the usage table weekly during the pilot.
3. **Cost Explorer**: group by service, filter by tag `amplify:app-id` (Amplify tags the stacks it creates).

## 4. Security model

| Layer | Control | Where |
|---|---|---|
| Identity | Cognito email + password (min 8 chars, letters + digits), email verification, account recovery | `amplify/auth/resource.ts`, `backend.ts` |
| Roles | Cognito groups `STUDENT` (auto on sign-up), `STAFF` + `DEPT_*`, `ADMIN`. Staff and admins are created only by an admin (`AdminCreateUser`) | post-confirmation trigger, `inviteStaff` |
| API authorization | AppSync rules per model: Asset = guest/auth read + admin write; Issue/IssueEvent = auth read only; Report/IssueLock = admin read only; **no client write access to issues at all** | `amplify/data/resource.ts` |
| Business authorization | Lambda re-checks every action: department membership, assignee, reporter-only verification, admin-only reassign/invalid, allowed state transitions | `shared/workflow.ts` (unit-tested) |
| Identity source | The caller is taken from the **verified token** (`event.identity`), never from arguments (tested: a spoofed `reporterSub` argument is ignored) | `handler.ts`, `tests/handler.test.ts` |
| Input validation | Asset-code regex, enum checks, text length limits, control characters stripped, photo keys restricted to `reports/{identityId}/…` or `repairs/…` (no traversal), at most 3 photos | `shared/validation.ts` |
| Upload security | IAM: students can write only `reports/${cognito-identity.amazonaws.com:sub}/*`; staff only `repairs/*`; the Lambda verifies the object exists, is JPEG/PNG/WebP and ≤ 5 MB. Bucket is private; reads use 15-minute pre-signed URLs | `amplify/storage/resource.ts`, `S3PhotoInspector` |
| Abuse | One report per person per issue (primary key), 10 reports/hour rate limit, admin "mark invalid" with reason, verified-email accounts | `service.ts` |
| Concurrency | Conditional writes for dedupe locks and status transitions | `appsyncRepo.ts` |
| Least-privilege IAM | Lambda Cognito permissions limited to 5 actions on one user pool ARN; S3 read only; AppSync access scoped to this API (verified in synthesized templates) | generated by Amplify |
| Errors | Domain errors return safe `CODE: message`; internal errors are logged with detail but the client only sees a generic message (tested: no ARNs leak) | `handler.ts` |
| Transport and headers | HTTPS only (Amplify/CloudFront), HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer, camera limited to self | `customHttp.yml` |
| Secrets | **None in the repo.** `amplify_outputs.json` (public IDs only) is git-ignored and generated at build time; `.env` is git-ignored | `.gitignore` |
| Privacy | Reporter identity is never shown to staff or other students; timelines show "Student"; EXIF GPS is stripped by on-device re-encoding; no phone or roll numbers collected | UI + schema |
| Logging | Structured JSON logs; no tokens, emails or photo contents are logged | `runtime.ts` |

### Threats considered
| Threat | Mitigation |
|---|---|
| Staff closes an issue without fixing it | Impossible: only a linked reporter can move RESOLVED → CLOSED. Unanswered fixes become `CLOSED_UNVERIFIED` and are reported separately |
| Ballot-stuffing priority | One confirmation per account (primary key); confirmations add points with diminishing returns (log2), capped at 20 |
| Fake or prank reports | Verified email accounts, rate limit, admin invalidation with an audit trail, campus-email domain restriction possible (Cognito pre-sign-up trigger, future) |
| Student marks every issue as "safety hazard" | The flag only works on safety-relevant issue types, and admins can see it in the timeline |
| Uploading malware or huge files | Client re-encodes to JPEG; server checks content type and size; bucket is never public |
| IDOR on reports | Report records are not client-readable; `myReports` filters by the token's `sub` |

## 5. Credential hygiene
- Never paste access keys into chat, code, screenshots or the repo. `npx ampx configure profile` stores them in `~/.aws/credentials` on your machine.
- Use a dedicated IAM user (`fixloop-deployer`) with `AmplifyBackendDeployFullAccess` [S8]. Remove admin rights after the one-time CDK bootstrap if you granted them.
- Rotate or deactivate the access key after Demo Day.

## 6. Cleanup procedure (after the competition)
1. **Sandbox (local dev stack):** `npx ampx sandbox delete --profile fixloop`.
2. **Production:** Amplify console → App → *Actions → Delete app*. This deletes the hosting and the branch backend stacks.
3. **Verify nothing is left** in ap-south-1:
   - CloudFormation: no stacks named `amplify-fixloop-*`.
   - S3: delete any remaining `amplify-*fixloopevidence*` buckets, plus the CDK bootstrap bucket `cdk-hnb659fds-assets-*` if no other project needs it.
   - DynamoDB, Cognito, AppSync, Lambda: nothing named `amplify-*` / `fixloop`.
   - CloudWatch Logs: delete `/aws/lambda/amplify-*` groups (they expire in 30 days anyway).
4. **IAM:** delete the `fixloop-deployer` access key and user.
5. **Budgets:** keep the alert until the next bill shows $0.
