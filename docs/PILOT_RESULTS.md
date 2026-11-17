# Pilot Results

> **Status (17 Nov 2026): the pilot has NOT started yet. No real users, reports or repairs have been recorded.**
> Every number in this file must come from the live system (Admin → Data → *Export: real data only*) or from dated field notes. **Demo data is never counted here.**

## 1. Pilot plan
| Item | Plan |
|---|---|
| Site | One hostel block (or academic block) on the team's own campus |
| Assets | 10–30 shared assets: water coolers, washrooms, corridor lights, common-room fans, Wi-Fi APs |
| Duration | Minimum 7 days before the 30 Nov submission; continue until Demo Day (17 Dec) |
| Users | Students of that block (QR stickers + one WhatsApp announcement); 1–3 cooperating caretakers or staff |
| Consent | In-app notice; no names or roll numbers collected; staff participation voluntary |
| Baseline | 7-day observation of the same assets + 10 student interviews (`PROBLEM_VALIDATION.md`) |

## 2. Metrics (fill from the CSV export; never estimate)
| Metric | Definition | Value | Date range | n |
|---|---|---|---|---|
| Pilot users | Distinct accounts that reported or confirmed | — | — | — |
| Real reports | Originals + confirmations (`isDemo = false`) | — | — | — |
| Distinct issues | Issue records (excluding INVALID) | — | — | — |
| Duplicates consolidated | Confirmations merged into existing issues | — | — | — |
| Median time to submit | `submitMs`, median, in seconds | — | — | — |
| Median time to acknowledge | `acknowledgedAt − reportedAt` | — | — | — |
| Median repair time | `resolvedAt − lastOpenedAt` | — | — | — |
| Verified closure rate | `CLOSED / (CLOSED + CLOSED_UNVERIFIED)` | — | — | — |
| Reopen rate | Issues reopened ≥ 1 ÷ issues that reached resolution | — | — | — |
| Repeat-fault assets | Assets that trip an asset-intelligence rule | — | — | — |
| Invalid reports | Marked invalid by an admin | — | — | — |

## 3. Qualitative findings
| Date | Source (interview/observation) | Finding | Supports / contradicts |
|---|---|---|---|
| — | — | *None recorded yet* | — |

## 4. What we will NOT claim
- No "X% faster repairs" unless we have a measured baseline **and** pilot data for the same assets.
- No institutional partnership unless one is confirmed in writing.
- No repair counts from demo data.

## 5. Honest fallback if staff do not participate
If no maintenance staff join in time, the pilot still measures the **student side** (time to report, duplicates consolidated, the number of real faults surfaced per asset), and the team performs the staff role only for **visibly labelled test issues**. These would be reported separately and **never** counted as real repairs.
