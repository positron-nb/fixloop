# Deployment Guide

Target: **AWS ap-south-1 (Mumbai)**, Amplify Gen 2. Two environments:
- **Sandbox**: a personal dev stack deployed from your laptop (`npx ampx sandbox`).
- **Production**: Amplify Hosting connected to the GitHub repo; every push to `main` runs the tests, then deploys backend + frontend.

> Steps marked 🧑 are account actions only the account owner can do: signing in, creating keys, accepting terms, connecting GitHub. Never paste secrets into chat.

## 0. Prerequisites
- Node.js ≥ 20.20 (tested with Node 24) and npm ≥ 10.
- An AWS account (see `AWS_COST_AND_SECURITY.md` §1 for the Free-plan checks).
- The repo cloned locally, then `npm ci`.
- Commands below use Bash syntax (`AWS_PROFILE=fixloop node …`). In **PowerShell** write `$env:AWS_PROFILE='fixloop'; node …` instead.

## 1. 🧑 Create a deploy user (works on the Free plan)
IAM Identity Center is **not** available on the Free plan [S4], so use an IAM user:
1. AWS console → **IAM → Users → Create user** → name `fixloop-deployer` (no console access needed).
2. **Attach policies directly:** `AmplifyBackendDeployFullAccess` [S8].
   - For the **one-time CDK bootstrap** (step 3) the first deploy needs broader rights. Either run step 3 while signed in to the console as the account owner (the CLI offers "Initialize setup now"), or temporarily attach `AdministratorAccess` and remove it right after.
3. User → **Security credentials → Create access key** → "Command Line Interface (CLI)". Keep the window open.
4. On your laptop, in the project folder:
   ```bash
   npx ampx configure profile --name fixloop
   ```
   Paste the key ID and secret **into this prompt only** and choose region `ap-south-1`. They are saved in `~/.aws/credentials`, never in the repo.

## 2. Verify credentials (prints only the account id and IAM user ARN, never keys)
```bash
AWS_PROFILE=fixloop node scripts/whoami.mjs
```

## 3. Deploy the sandbox (dev backend)
```bash
npx ampx sandbox --profile fixloop
```
- First run in the region: follow the bootstrap prompt (one time, ~3 minutes).
- Deploy takes ~5–8 minutes. It writes `amplify_outputs.json` (git-ignored) and keeps watching for changes.
- In another terminal: `npm run dev` → http://localhost:5173.

Create the first administrator (Cognito emails a temporary password):
```bash
AWS_PROFILE=fixloop node scripts/bootstrap-admin.mjs --email you@college.ac.in --name "Your Name"
```
Sign in at `/signin`, then go to **Admin → Data → Load demo data** (optional, labelled DEMO), **Admin → People** to invite staff, and **Admin → Assets** to add real assets and print QR labels.

## 4. 🧑 Production: Amplify Hosting
1. Push the repo to GitHub (public repo, per the competition's recommendation).
2. AWS console (region **ap-south-1**) → **AWS Amplify → Create new app → GitHub** → authorise Amplify → choose the repo and the `main` branch [S7].
3. Amplify detects `amplify.yml`: `npm ci` → `npm test` → `ampx pipeline-deploy` (backend) → `npm run build` (frontend). Save and deploy (~8 minutes).
4. **Rewrite for QR deep links:** App → Hosting → *Rewrites and redirects* → make sure this rule exists (new apps usually include it):
   | Source | Target | Type |
   |---|---|---|
   | `/<*>` | `/index.html` | 404-200 (Rewrite) |
5. Copy the app URL (`https://main.<id>.amplifyapp.com`). QR labels encode `<that URL>/a/<asset code>`, so **print labels from the production site**.
6. Download `amplify_outputs.json` for the production branch (Deployments → *Deployed backend resources*), then create the production admin:
   ```bash
   AWS_PROFILE=fixloop node scripts/bootstrap-admin.mjs --email you@college.ac.in --name "Your Name"
   ```

## 5. Verify the deployment
```bash
SMOKE_URL=https://main.<id>.amplifyapp.com node scripts/smoke.mjs
```
Checks: HTTPS home page, SPA deep link `/a/<code>`, PWA files, HSTS, and that the API **refuses** unauthenticated reads, writes and forged tokens. Then run the manual checklist in the README (§Testing).

## 6. Keep it alive through Demo Day (17 Dec 2026)
- Don't delete the sandbox or the Amplify app; don't let the Free plan expire (see the cost doc).
- Keep the `main` branch green: a failing test blocks deploys, but the last good version stays live.
- Optional custom domain: Amplify → *Custom domains* (needs a domain you own; not required).

## Troubleshooting
| Symptom | Fix |
|---|---|
| `ampx sandbox` → "credentials not found" | `--profile fixloop`, or `set AWS_PROFILE=fixloop` (PowerShell: `$env:AWS_PROFILE='fixloop'`) |
| "This stack uses assets, so the toolkit stack must be deployed" | Run the bootstrap (step 1.2 / 3) |
| Deep link `/a/X` shows 404 on production | Add the rewrite in step 4.4 |
| Signed in but Staff/Admin pages say "not available for your role" | Groups are read from the token: sign out and in again after group changes |
| Invitation email not received | Check spam. Cognito's default email sender is limited to 50 emails/day. To resend: Cognito console → Users → the user → *Reset password* |
| Free plan says the service needs an upgrade | Stop. Ask the account owner; upgrading is an account decision (credits still apply on Paid) |
