# Idea Selection

Decision date: 17 Nov 2026. Sources: `[S#]` in `SOURCE_REGISTER.md`.

## 1. Candidates

| # | Idea | One-line description |
|---|---|---|
| A | **FixLoop**: campus asset maintenance loop | QR per physical asset → student report → duplicate consolidation → department routing → evidence-based repair → reporter verification → asset failure history |
| B | **Scholarship readiness and document checker** | Help students pre-check scholarship applications (NSP and state portals) for mismatches before submission |
| C | **Campus/public-service queue manager** | Virtual tokens and live queue status for offices, hospitals, mess and fee counters |
| D | **Water-leakage and utility reporting** | Citizens report leaks and supply failures to the municipal utility |

## 2. Evidence per idea

| Idea | Problem evidence | Existing solutions (saturation) | Operational dependency |
|---|---|---|---|
| A | Hostel protests over fans, water and washrooms in 2025–26 [S24–S28]; NAAC 4.4 maintenance metric [S23]; UGC grievance regulations and 228 defaulters [S21][S22]; 58k+ institutions [S20] | Student repos with basic complaint CRUD [S44–S46]; commercial CMMS priced in USD [S43]; nothing combining QR asset, dedupe and verification for Indian campuses | Needs maintenance staff to act on reports. **We can pilot on our own campus** |
| B | Name or document mismatch is a common rejection cause; NMMS has no correction window [S53]; NSP rules changing in 2026-27 [S52] | NSP itself plus many guide sites | Handles sensitive PII (Aadhaar, bank, income certificates); OCR needs **Amazon Textract, which is Paid-plan only** [S4]; correctness errors could cost students money |
| C | ABHA Scan & Share cut OPD registration waits [S50] | **Already deployed at large scale**: 2 crore registrations [S51] | Needs a willing hospital or office to adopt; hard to pilot in 13 days |
| D | Non-revenue water of 35–65% in Indian cities; 3,530 leakage cases in two cities [S54][S55] | Municipal apps, Swachhata-style apps | **Repairs depend on the municipality acting**, and we cannot close the loop in a pilot |

## 3. Weighted decision matrix

Scores run 1 (poor) to 5 (excellent). The weights trace back to the judging criteria: Bharat Impact 30% maps to impact, real users and validation; AWS Build 25% maps to feasibility and AWS fit; Innovation 25% maps to innovation and saturation; Demo 20% maps to demo quality. Risk and scalability break ties.

| Criterion | Weight | A FixLoop | B Scholarship | C Queue | D Water |
|---|---:|---:|---:|---:|---:|
| Bharat Impact (problem severity × reach) | 15 | 4 | 5 | 4 | 5 |
| Innovation / freshness | 12 | 4 | 3 | 2 | 2 |
| Feasibility in 13 days | 15 | 4 | 2 | 4 | 4 |
| AWS implementation quality fit (free plan) | 10 | 5 | 3 | 4 | 4 |
| Availability of real users for a pilot | 12 | 5 | 3 | 2 | 2 |
| Ability to validate the problem | 8 | 4 | 3 | 3 | 3 |
| Competitor saturation (5 = little competition) | 8 | 3 | 3 | 2 | 2 |
| Demonstration quality (live, physical, 3 min) | 10 | 5 | 3 | 4 | 3 |
| Long-term scalability | 5 | 4 | 4 | 4 | 4 |
| Operational risk (5 = low risk) | 5 | 4 | 2 | 2 | 1 |
| **Weighted score (out of 100)** | **100** | **84.8** | **63.0** | **63.6** | **63.6** |

Formula: Σ(score/5 × weight). For example, FixLoop scores 15·0.8 + 12·0.8 + 15·0.8 + 10·1.0 + 12·1.0 + 8·0.8 + 8·0.6 + 10·1.0 + 5·0.8 + 5·0.8 = 84.8.

**Sensitivity check.** If Bharat Impact is weighted twice as heavily (30 instead of 15, with all other weights scaled down proportionally), FixLoop still leads (about 84 vs about 70 for B and D). FixLoop loses only if feasibility and real-user access are ignored entirely, and the judges explicitly reward "working builds" and "real-world impact" [S1].

## 4. Decision

**Selected: A, FixLoop.** Tagline: *Scan it. Report it. Track it. Verify the fix.*

**Why it wins:**
1. **We are the users.** The team can pilot it on its own campus within days and produce real numbers: reports, consolidated duplicates, time to acknowledge, verification rate. Judges weight "how real is the problem" at 30%.
2. **It is honestly innovative.** The individual parts exist elsewhere [S39][S41][S33], but the **closed loop (asset → dedupe → evidence → reporter verification → asset memory)** does not exist for Indian campuses.
3. **Best live demo.** A physical QR sticker, a phone scan, the dashboard updating live, then a reopen. Judges see the product, not slides.
4. **Every AWS service needed is Free-plan eligible** [S4], and the design shows several services used well (Cognito groups, AppSync real-time, Lambda business rules, private S3, an EventBridge schedule).

**Why not the others:**
- **B** has high impact, but needs Textract (Paid plan only) and sensitive PII, and a wrong verdict could cost a student a scholarship. The risk is too high for 13 days.
- **C** is already solved at national scale by ABHA Scan & Share [S51].
- **D** cannot close the loop without a municipality; FixLoop's verification loop *is* the innovation.

## 5. Bharat-scale framing (honest)
FixLoop starts on campuses because that is where the team can prove it. The same model (asset QR → dedupe → evidence → citizen verification) applies directly to **government school toilets, PHC equipment, hostel blocks and railway-station water booths**. Indian Railways already QR-tags fire extinguishers for maintenance [S35] and links eatery QRs to Rail Madad [S34], which shows the pattern is acceptable to Indian institutions. We present this as a **future direction**, not a current capability.

## 6. Risks accepted
| Risk | Mitigation |
|---|---|
| Staff do not respond during the pilot | Recruit 1–2 cooperative caretakers or estate staff; scheduled SLA escalation; report the honest numbers either way |
| Few real users in 10 days | Target one hostel block (5–15 assets); measure even small samples honestly |
| Judges see it as "just another complaint app" | Lead the demo with the **reopen** and **repeat-failure asset** moments, not the form |
| QR stickers removed or damaged | Manual asset-code entry fallback; laminated labels |
