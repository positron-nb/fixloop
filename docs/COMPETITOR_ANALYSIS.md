# Competitor Analysis

Sources: `[S#]` in `SOURCE_REGISTER.md`. The repositories were inspected through the GitHub API on 17 Nov 2026: file trees, schemas, controllers and middleware. **Nothing was copied.** The repositories carry no licence (see below), so their code cannot legally be reused at all. We use them only to understand the state of the art.

## 1. Open-source campus complaint systems

### 1.1 anshulmodi07/Campus-Complaint-Management-System [S44]
| Aspect | Finding |
|---|---|
| Positioning | "Civic App" for NIT Delhi, treating the campus as a "mini city" |
| Frontend | React Native + Expo (student and worker apps); separate React/Vite admin panel |
| Backend | Node/Express, MongoDB/Mongoose |
| Data model | `Complaint` (hostel/campus type; hostel, floor, room or landmark; area), with a separate `Task` collection created when a worker accepts |
| Auth | Custom JWT middleware; roles are student, worker and admin |
| Images | `multer` writes to the local `uploads/` directory, which is lost on redeploy unless backed by a volume |
| Features | Raise complaint with photo, support toggle (upvote), nearby complaints, worker accept → start → complete, "incomplete" outcome |
| Licence | **None declared** (all rights reserved by default) |
| Activity | 15 commits; last push 27 Jun 2026 |
| Limitations | The repo's own `WORKER_VULNERABILITIES.md` says "`user.department` filtering is only applied in the UI" and that photo proof on completion is enforced only client-side. The admin panel ships with many `mock/` and `data/` files, which suggests mocked dashboards |
| Inspiration | Splitting the student-facing complaint from the worker-facing task is a clean idea; we keep one issue with a strict state machine instead |

### 1.2 Jayesh-Kr/Campus-Complaint-Management-System ("Campus Desk") [S45]
| Aspect | Finding |
|---|---|
| Positioning | A DBMS course project |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Backend | Express 5 + MySQL; SQL views and triggers for audit logging |
| Data model | `student`, `staff`, `complaint` (status/priority enums), `response`, `feedback` (rating 1–5), `complaint_audit` |
| Auth | JWT + bcrypt |
| Licence | **None declared** |
| Activity | 7 commits; last push 3 Apr 2026 |
| Limitations | The create-complaint controller reads `student_id` from the **request body** rather than the authenticated token. Priority is chosen by the student. No location or asset model. No photos |
| Inspiration | The audit trigger approach: we keep an immutable `IssueEvent` timeline |

### 1.3 trivikramrajurkar/CampusComplaint [S46]
| Aspect | Finding |
|---|---|
| Positioning | "Campus Complaint and Feedback Portal" with a class-coordinator verification layer |
| Frontend | React + Vite + Tailwind; Vercel config |
| Backend | Express + Prisma + PostgreSQL; local `multer` disk uploads (JPEG/PNG/WebP/PDF) |
| Data model | `User`, `Class`, `Department`, `Complaint`, `ComplaintUpdate`, `Feedback`, `AuditLog`; statuses run PENDING_VERIFICATION → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED |
| Auth | JWT; server-side role checks in controllers (e.g., a DEPARTMENT user can only see their department's complaints) |
| Routing | A static category → department map (`complaintRoutingService.js`) |
| Licence | **None declared** |
| Activity | 8 commits; last push 21 Oct 2026 |
| Limitations | A human coordinator gate adds delay before any work starts. No duplicate handling, asset concept or reopen flow. "RESOLVED" is set by staff alone |
| Inspiration | Server-side scoping by department, which we enforce in Lambda as well |

### 1.4 AWS reference repositories (MIT-0, reuse allowed)
| Repo | Use for FixLoop |
|---|---|
| aws-samples/amplify-vite-react-template [S13] | Project layout for Amplify Gen 2 + Vite + React (`amplify/` backend folder, `amplify_outputs.json`). We write our own app, following its structure |
| aws-samples/serverless-samples [S14] | Patterns for Lambda + DynamoDB validation and error handling |
| aws-samples/serverless-tasks-webapp [S15] | A Vue workshop app; last push Feb 2024, so treat it as dated. Shows a Cognito + API + DynamoDB task flow |
| aws-powertools/powertools-lambda-typescript [S16] | Structured JSON logging. We use a tiny structured logger instead of the full dependency to keep bundles small; logs follow the same JSON-line convention |

## 2. Feature gap matrix

✅ = present; ◐ = partial; — = absent. Based on code and docs inspected, plus public descriptions for the non-open-source products.

| Capability | anshul [S44] | Jayesh [S45] | trivikram [S46] | Swachhata [S32][S33] | CMMS: UpKeep etc. [S41] | **FixLoop** |
|---|---|---|---|---|---|---|
| Report tied to a **physical asset** via QR | — | — | — | — (geo-photo) | ✅ | ✅ |
| Asset **repair history and repeat-failure flag** | — | — | — | — | ✅ (paid) | ✅ |
| **Duplicate consolidation** (confirm, don't re-file) | ◐ upvote | — | — | — | — | ✅ (same asset + same issue type) |
| **Transparent, rule-based priority** | — (student picks) | — (student picks) | — (student picks) | — | ◐ manual | ✅ (documented formula) |
| Department routing | ✅ | ◐ (admin assigns) | ✅ | ✅ | ✅ | ✅ |
| **Server-enforced** role and department authorization | ◐ (UI-only filter noted) | ◐ | ✅ | n/a | ✅ | ✅ (Cognito groups + Lambda checks) |
| Repair evidence required | ◐ (UI-only) | — | — | ✅ photo proof | ◐ | ✅ (server-validated) |
| **Reporter verifies or reopens** | — | ◐ feedback | ◐ feedback | ✅ reopen within 7 days | — | ✅ |
| SLA tracking and escalation | — | — | — | ? | ✅ | ✅ (scheduled Lambda) |
| Hindi + English | — | — | — | ✅ | — | ✅ |
| Cost to institution | self-host | self-host | self-host | free (government) | USD per user per month [S43] | AWS free tier |
| Cloud-native, no server to maintain | — | — | — (Vercel + Postgres) | n/a | SaaS | ✅ (serverless) |

## 3. Indian civic platforms: lessons

| Platform | Lesson for FixLoop |
|---|---|
| CPGRAMS [S30][S31] | Even at national scale, a timeline matters: the 21-day guideline and 15-day average are published monthly. **Publish SLA performance per department** |
| Swachhata [S32][S33] | Photo proof on resolution plus citizen reopen works at crore scale. **Require evidence, let the reporter reopen** |
| BBMP Sahaaya [S38] | "Marked resolved but not resolved" destroys trust. **Staff alone must not be able to close an issue** |
| iChangeMyCity [S37] | Community up-voting works for prioritisation. We replace votes with **verified, one-per-person confirmations** that feed a transparent score |
| Rail Madad QR [S34] / CRIS fire-extinguisher QR [S35] | Indian users and Indian institutions already use QR for this. **Adoption risk is low** |
| FixMyStreet [S39][S40] | Suggest duplicates before filing. Campuses are indoors, so we match on **asset + issue type** instead of map radius, which is more precise |

## 4. Where FixLoop must not overclaim
- QR scan-to-request is **not new**: CMMS vendors have it [S41][S42]. Our novelty is **the closed verification loop and per-asset memory, delivered in Hindi/English, free to run, for Indian campuses**.
- Duplicate suggestion exists in FixMyStreet [S39]. We say we **adapted** a proven civic-tech pattern to indoor assets.
- Swachhata already has photo proof [S33]. We say we **bring that discipline to campuses**, plus repeat-failure analytics.

## 5. Competitive positioning statement
> **FixLoop is the maintenance memory for Indian campuses.** Every water cooler, washroom and fan gets a QR identity. Students report in about 20 seconds, in Hindi or English, without filing duplicates. Staff can close an issue only with evidence, and the student confirms the fix. The administration sees, for the first time, which assets keep failing.
