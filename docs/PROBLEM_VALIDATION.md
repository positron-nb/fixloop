# Problem Validation Plan

**Status on 17 Nov 2026: no primary validation has been conducted yet.** This document separates **assumptions** from **validated findings**. Findings are added only after real conversations or observations, with date, count and method. No numbers here are invented.

## 1. Problem hypothesis
> On Indian campuses, everyday infrastructure faults (water coolers, washrooms, fans, lights, Wi-Fi) are reported through informal channels: WhatsApp groups, registers, verbal requests to a caretaker. As a result, (1) students don't know whether anyone is acting, (2) the same fault is reported many times or not at all, (3) "fixed" issues recur because nobody verifies, and (4) administrators have no per-asset history to justify replacement over repeated repair.

## 2. Assumptions register

| # | Assumption | Type | Evidence today | How we validate | Status |
|---|---|---|---|---|---|
| A1 | Students experience broken shared facilities at least monthly | Problem | News reports of hostel protests [S24–S28] (anecdotal, not frequency data) | Survey Q1–Q3; observe 10 assets for 7 days | **Unvalidated** |
| A2 | Most reports go through informal channels with no tracking ID | Problem | Competitor READMEs state this, e.g. "relies on WhatsApp groups and verbal complaints" [S44] (developer claim, not data) | Survey Q4–Q6; caretaker interview | **Unvalidated** |
| A3 | Duplicates are common (several people reporting one fault) | Problem | None for campuses; FixMyStreet built a duplicate feature for this reason [S39] | Count duplicates during the pilot (`DUPLICATES_CONSOLIDATED` metric) | **Unvalidated** |
| A4 | Faults get marked fixed but recur or were never fixed | Problem | Civic analogue: Sahaaya closure disputes [S38] | Survey Q8; pilot reopen rate | **Unvalidated** |
| A5 | Students will scan a QR code rather than message a group | Solution | QR complaint precedent in Rail Madad [S34] | Pilot: scans vs reports; median time to submit | **Unvalidated** |
| A6 | Maintenance staff will use a phone web app to accept and close tasks | Solution | None | Staff interview S1–S8; pilot acknowledgement time | **Unvalidated** (highest risk) |
| A7 | Administrators value per-asset failure history | Value | NAAC 4.4 requires maintenance evidence [S23] (indirect) | Admin interview M1–M6 | **Unvalidated** |
| A8 | Hindi support matters for staff more than for students | Usability | Assumption | Staff interview S7; language toggle usage in the pilot | **Unvalidated** |

## 3. Discovery interviews

**Method:** 15-minute semi-structured conversations. Record only notes, never names in the repository. Get verbal consent and explain that notes are anonymised.

Targets by 25 Nov: **10 students** across at least 2 hostels or departments, **2–3 maintenance staff** or caretakers, and **1 administrator** (warden, estate officer, or hostel council member).

### 3.1 Students (about 10 minutes)
1. In the last month, did you notice something broken on campus: a water cooler, washroom, fan, light, Wi-Fi, lab equipment? What was it?
2. How long did it stay broken, to your knowledge?
3. How often does this kind of thing happen in your hostel or block?
4. What did you do about it? (Nothing / told someone / WhatsApp group / register / portal / email)
5. If you reported it, did you get any confirmation or reference number? Did anyone tell you when it was fixed?
6. Do you think others had already reported it? How would you know?
7. What stops you from reporting? (Takes effort / no point / don't know whom to tell / fear)
8. Has something been "fixed" and then broken again soon after? Tell me about it.
9. If you could scan a sticker on the cooler and report in 20 seconds, would you? What would make you stop using it?
10. Hindi, English or both: which would you choose for such an app?

### 3.2 Maintenance staff / caretakers
- S1. How do complaints reach you today? (Register, phone, WhatsApp, supervisor)
- S2. Roughly how many complaints in a typical week? Which assets most often?
- S3. How do you know which complaints are the same problem reported twice?
- S4. What makes a job hard to close? (Parts, approvals, access to room, unclear location)
- S5. Do you ever get blamed for something already fixed, or not told about something broken?
- S6. Do you use a smartphone at work? WhatsApp? Camera?
- S7. Would you prefer Hindi or English on a work app?
- S8. Would uploading an "after" photo be acceptable? What would make it difficult?

### 3.3 Administrator / warden / estate officer
- M1. How do you currently know how many complaints are pending, and for how long?
- M2. How do you decide when to replace an asset instead of repairing it?
- M3. What do you show for NAAC or for audits about maintenance?
- M4. What would make you trust a student-reported issue (false reports, pranks)?
- M5. Who would own a system like this: estate, hostel office or IT?
- M6. What would stop you from adopting it? (Privacy, staff resistance, cost, approvals)

## 4. Observation study (no interviews needed)
Pick 10 shared assets in one hostel block (coolers, washroom taps, corridor lights) and photograph or check them at the same time daily for 7 days. Record working, partly working or broken. This gives a **baseline** for fault frequency without relying on memory.

## 5. Success and kill criteria
| Signal | Proceed if | Reconsider if |
|---|---|---|
| A1 frequency | ≥ 6 of 10 students recall a fault in the last month | ≤ 3 of 10 |
| A2 informality | ≥ 6 of 10 never received a tracking ID | Most already use a working portal with IDs |
| A6 staff adoption | ≥ 1 staff member willing to try for one week | No staff willing. Pivot the pilot to student-facing transparency plus admin, and record that honestly |

## 6. Validated findings log
> Add rows only after real conversations or observations. Do not paraphrase into larger numbers.

| Date | Method | n | Finding | Supports / contradicts |
|---|---|---|---|---|
| — | — | — | *No findings recorded yet* | — |

## 7. Ethics and privacy
- No names, roll numbers or phone numbers in the repository or slides.
- Interview notes live outside the repo. Only aggregated counts go here.
- Pilot users accept a short in-app notice explaining what is stored: email for sign-in, reports and photos. Photos should show assets, not people.
