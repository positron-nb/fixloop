# Research Report

Prepared 17 November 2026, 13 days before the Round 1 deadline. Sources are cited as `[S#]` (see `SOURCE_REGISTER.md`).

## 1. What the competition rewards

### 1.1 Judging weights (identical in the PDF and Round 2) [S1]

| Criterion | Weight | What the judges ask | What it means for us |
|---|---|---|---|
| Bharat Impact | 30% | "How real is the problem, and how well does the solution serve Indian users?" | Evidence of a real problem plus a pilot with real users. Hindi/English. Works on cheap phones and patchy networks |
| Working AWS Build | 25% | "Is it live on AWS, does it work, and are the AWS services used well?" | Live URL, real auth, real data, sensible AWS choices that stay inside the free tier |
| Innovation | 25% | "How fresh is the idea or the approach?" | Something that existing complaint portals do not do |
| Demo & Storytelling | 20% | "How clearly does the team show who it helps and how?" | A 3-minute live flow with a physical moment: scan, report, fix, verify |

### 1.2 Differences between the PDF [S1] and the website [S2]

Checked on 17 Nov 2026. **Don't assume old rules still apply: re-check the portal's "Doubts" section before submitting.**

| Topic | PDF [S1] | Website [S2] | Action |
|---|---|---|---|
| Submission format | "All the above deliverables must be submitted together in a single Google Drive folder", with the link pasted in the 'Submission Link' field | Not mentioned | **Follow the PDF**: prepare a Google Drive folder with docs, URL, repo link and video |
| Builder Center alias | "you will need to paste your Builder Center alias, your idea and your live project URL in the submission link" | Builder Center sign-up is listed as needed "to qualify to win" | Have the alias ready |
| Student verification | Recommended by **27 Nov** | Same, in the FAQ | **Verify by 27 Nov**: a hard personal task for every team member |
| Free Tier rule | "Build on the AWS Free Tier" | Rule 6: "Solutions must be built and deployed using AWS Free Tier" | Stay on free-tier-eligible services (see §4) |
| Originality | Rule 7: "not protected by patents, copyrights, or publications" | Only "original work" | Write our own code; cite the MIT-0 AWS samples we learn from |
| Public repo | "encouraged" | "encouraged" | We will make it public |
| Demo video | Under 3 minutes, covering problem, who it helps, how it works, impact, and why people should care | Under 3 minutes | Script in `DEMO_SCRIPT.md` |
| Queries | Doubts section of the portal; emailed queries are not entertained | Same | — |
| Judging criteria | Table on page 4 | Not shown in the page text | Use the PDF table |

Timelines match: registration and submission close **30 Nov 2026, 11:59 PM IST**. Results by **5 Dec**. Demo Day is **17 Dec 2026** at IIT Bombay with a 3-minute demo and 2-minute Q&A.

## 2. Problem space: what we found

### 2.1 Scale
- India's higher-education system has **4.33 crore students** across **1,168 universities, 45,473 colleges and 12,002 standalone institutions** (AISHE 2021-22) [S20]. Every one of these campuses runs water coolers, washrooms, fans, lights, Wi-Fi access points and labs that break.
- Accreditation already demands maintenance discipline. NAAC Criterion 4.4, "Maintenance of Campus Infrastructure", asks institutions to document maintenance systems and spending [S23]. Most institutions show this with policy PDFs, not operational data.
- Regulation already demands grievance handling. The UGC Student Grievance Regulations (2023) require grievance committees and an ombudsperson [S21]. UGC later listed **228 universities** that had not appointed one [S22].

### 2.2 Symptoms reported in 2025–26 news
- **NLSIU Bengaluru:** students staged an overnight protest. They cited irregular water supply and ceiling fans falling in men's and women's hostels, and described the complaints as long-pending with an inadequate response [S24].
- **JNU:** a ceiling fan fell in a Tapti hostel room, prompting demands for infrastructure repairs [S25].
- **Lady Hardinge Medical College (April 2026):** about 200 students protested repeatedly ignored issues, including unsafe drinking water and washrooms [S26].
- **OP Jindal:** students reported flooded rooms and falling ceilings [S27]. In **Bhopal colleges**, dirty-water complaints are common [S28].

**Pattern.** The reports describe two failures, not one:
1. **Signal loss:** issues get raised (on WhatsApp, by word of mouth, in registers) but are never tracked to closure.
2. **Memory loss:** the same asset fails repeatedly, yet nobody can see that history, so the institution keeps patching instead of replacing.

### 2.3 What the evidence does not show
- **No public dataset** gives average campus repair times in India. We don't claim one.
- No primary interviews have been done yet. `PROBLEM_VALIDATION.md` holds the plan, and the pilot is how we will produce our own numbers.

## 3. Existing solutions (summary; detail in `COMPETITOR_ANALYSIS.md`)

| Solution | Domain | What it does well | Gap relevant to campuses |
|---|---|---|---|
| CPGRAMS [S30][S31] | Central-government grievances | Scale; average disposal about 15 days against a 21-day guideline | Built for policy and administrative grievances, not tagging a broken water cooler to its location |
| Swachhata-MoHUA [S32][S33] | Urban sanitation | 2.39 crore complaints; photo proof on resolution; 93.72% reported resolution | City sanitation scope; complaints are geo-tagged photos, not assets with a repair history |
| Rail Madad QR at eateries [S34] / QR fire-extinguisher monitoring [S35] | Railways | Proves QR-first reporting works for Indian users and that the government already tags assets with QR codes | Railway-specific; closed systems |
| iChangeMyCity [S37], BBMP Sahaaya [S38] | Civic | Agency routing, community up-voting | Closures disputed: "marked resolved while still unresolved" [S38] |
| FixMyStreet [S39][S40] | UK civic | Suggests duplicates before filing (same category, nearby) | Map-pin based; not built for indoor campus assets |
| UpKeep / MaintainX / Limble CMMS [S41][S42][S43] | Commercial maintenance | QR scan-to-request; asset history | Priced per user per month in USD; English-first; no student verification of closure |
| GitHub campus complaint systems [S44][S45][S46] | Student projects | Role-based workflows | No asset binding, no duplicate merge, no reporter verification; one has a client-side-only department filter (see the competitor analysis) |

**Takeaway.** Each building block exists somewhere: QR intake in CMMS and railways, duplicate suggestion in FixMyStreet, photo proof in Swachhata. **No Indian campus tool combines asset-anchored QR reporting, duplicate consolidation, reporter-verified closure and per-asset failure history**, and that combination is what fixes both signal loss and memory loss.

## 4. AWS feasibility findings

- **Account model.** New AWS accounts (from 15 Jul 2025) choose a **Free plan** (6 months or until credits run out; no charges) or a **Paid plan**. Both get $100 plus up to $100 in credits [S3][S5].
- **Free-plan eligibility.** Amplify, AppSync, Cognito, DynamoDB, Lambda, S3, CloudWatch, CloudFormation, EventBridge and Budgets are all on the eligible list [S4].
- **Two traps:**
  - **IAM Identity Center and AWS Organizations are not supported** on the Free plan, and joining Organizations **auto-upgrades the account to Paid** [S4][S5]. The Amplify setup guide recommends Identity Center [S8], so on a Free-plan account we must use an IAM user with `AmplifyBackendDeployFullAccess` plus access keys.
  - The Free plan's **6-month limit** must not expire before 17 Dec 2026. An account created after mid-June 2026 is safe.
- **Free-tier headroom:**

  | Service | Free allowance | FixLoop's expected use |
  |---|---|---|
  | AppSync [S10] | 250k operations and 250k real-time updates per month | Orders of magnitude below this |
  | Cognito [S11] | 10k MAU | Tens to hundreds of users |
  | Amplify Hosting [S9] | 1,000 build minutes, 15 GB transfer | About 50 builds × 4 min |

- **Architecture guidance.** AWS's decision guide calls AppSync "best for mobile and web apps with complex data requirements", with real-time subscriptions [S6]. FixLoop needs per-role authorization, a live admin dashboard and a typed client, so **Amplify Gen 2 (AppSync + DynamoDB + Cognito + Lambda + S3)** fits better than hand-writing API Gateway routes. Rationale is in `ARCHITECTURE.md`.

## 5. Research conclusions
1. The problem is real and recurring, but **publicly unquantified**. That is both a risk (weaker statistics) and an opportunity: FixLoop produces the first data an institution would have.
2. The **innovation is the combination, not any single feature**, and it must be stated honestly as such.
3. A **pilot on our own campus** is feasible in 10 days because we are the users. Staff cooperation is the main dependency.
4. Every AWS service we need is on the Free-plan eligible list. Deployment depends only on the team creating credentials.
