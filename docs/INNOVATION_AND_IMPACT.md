# Innovation and Impact

## What is actually new (stated honestly)
FixLoop does **not** claim to have invented QR reporting, duplicate detection or photo proof. Each exists somewhere:

| Building block | Where it already exists |
|---|---|
| QR scan-to-request on an asset | Commercial CMMS tools such as UpKeep and MaintainX [S41][S42]; Rail Madad QR at railway eateries [S34] |
| "Already reported nearby?" duplicate suggestion | FixMyStreet (UK) [S39][S40] |
| Photo proof of resolution + citizen reopen | Swachhata-MoHUA [S33] |
| Asset maintenance history | Commercial CMMS (paid, per user, in USD) [S43] |

**The innovation is the closed loop, built for Indian campuses:**

1. **Asset-anchored dedupe.** Campuses are indoors, so map radius is useless. FixLoop treats *same asset + same problem type + still active* as the same issue, enforced atomically in the database. The second reporter becomes a confirmation, which adds priority without adding a ticket.
2. **Reporter-verified closure.** Staff physically cannot close an issue; only someone who reported or confirmed it can. Unverified closures are counted separately and never inflate success numbers. This targets the trust failure seen in civic portals, where complaints are "marked resolved while still unresolved" [S38].
3. **Verified confirmations, not up-votes.** One person, one confirmation (enforced by the database key), with diminishing returns (log2) and a cap. That makes priority hard to game.
4. **Explainable priority.** Every point of the 0–100 score is shown to students, staff and admins. No black-box AI.
5. **Per-asset memory with transparent rules.** The fourth failure of the same cooler is flagged automatically for preventive maintenance, with the rule shown. No predictive claims.
6. **Bharat-first delivery.** Hindi and English throughout (including the sign-in screens), no app install, works on low-end Android, compresses photos on the phone to save data, and is free to run on AWS.

## Who benefits, and how (expected, to be validated)

| Stakeholder | Before | With FixLoop |
|---|---|---|
| Student | Complains on WhatsApp; no idea if anyone acted; repeats the complaint | 20-second report, a live status, a say in whether it is really fixed |
| Caretaker / technician | Verbal and phone requests, duplicates, unclear location | Department queue sorted by explained priority, the exact asset and location, photo evidence |
| Warden / estate office | No numbers; learns about failures through protests | Live SLA, overdue escalations, department performance, repeat-failure list |
| Institution (IQAC/NAAC) | Maintenance evidence is policy PDFs [S23] | Exportable data on every fault, response time, repair and verification |

## How we will measure impact (no invented numbers)
`PILOT_RESULTS.md` tracks real pilot data only:

| Metric | Source |
|---|---|
| Pilot users and reports | Cognito user count; issue and report records (`isDemo = false`) |
| Duplicates consolidated | Confirmations merged into existing issues |
| Median time to submit | `submitMs` |
| Median acknowledgement and repair time | Lifecycle timestamps |
| Verified closure rate | `CLOSED` ÷ (`CLOSED` + `CLOSED_UNVERIFIED`) |
| Reopen rate | Issues reopened at least once ÷ issues that reached resolution |
| Repeat-fault assets | Assets that trip an asset-intelligence rule |

A **baseline** comes from the observation study and interviews in `PROBLEM_VALIDATION.md`.

## Scale path for Bharat
1. **One hostel → one campus:** print labels for 30 assets, invite 3–5 staff, run for 2 weeks.
2. **Campus → many campuses:** each institution deploys its own copy (config in `shared/catalog.ts`). The cost stays inside free tiers at pilot scale.
3. **Campus → public infrastructure (future):** the same loop fits government schools, PHCs, municipal hostels and station water booths, where QR-based reporting is already familiar to Indian users [S34][S35].
