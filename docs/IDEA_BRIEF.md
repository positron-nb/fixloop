# FixLoop: Idea Brief

**Scan it. Report it. Track it. Verify the fix.**
*Techfest IIT Bombay 2026-27 · Campus to Cloud Hackathon sponsored by AWS*

## The problem
Every Indian campus runs on shared things that break: water coolers, washrooms, ceiling fans, corridor lights, Wi-Fi, projectors. India has **4.33 crore** higher-education students across **58,000+** institutions [S20]. When something breaks today:

- The report goes to a WhatsApp group, a register or a caretaker's memory. **There's no ticket and no tracking.**
- Ten students complain about the same cooler, or nobody does because they assume someone already has.
- "Fixed" is declared by the person who fixed it. **Nobody checks.** The fault returns, and nobody remembers that this is the fourth time.
- Administrators can't see which assets keep failing, so they keep paying for patches instead of a replacement.

This is not hypothetical. In 2025–26, students at NLSIU protested overnight after ceiling fans fell in hostels and water failed, describing long-pending complaints [S24]. A fan fell in a JNU hostel room [S25]. Lady Hardinge Medical College students protested repeatedly ignored issues, including unsafe drinking water [S26]. Accreditation (NAAC Criterion 4.4) already asks institutions to show how they maintain infrastructure [S23], and UGC's 2023 regulations require grievance redressal, yet 228 universities had not even appointed an ombudsperson [S22].

**Two failures, one root cause:** signal loss (complaints vanish) and memory loss (repairs are never verified or remembered).

## Who it's for
- **Students** (primary): report in about 20 seconds, in Hindi or English, without an app install, and know what happens next.
- **Maintenance staff** (caretakers, electricians, plumbers, housekeeping): a phone-friendly task queue for their department, ordered by a transparent priority.
- **Administrators** (wardens, estate officers, IQAC): live visibility, SLA tracking, repeat-failure assets and evidence for audits.

## How it works
1. **Every asset gets a QR identity**, printed from FixLoop as a bilingual label ("कुछ खराब है? स्कैन करें").
2. **Scan → the asset opens** with its location and the problems already reported on it.
3. **Report or confirm:** choose the problem (e.g. "No water"), add a photo if you like, submit. If it is already reported, your report becomes an **independent confirmation**: no duplicate ticket, but higher priority.
4. **Transparent priority** (0–100, explained point by point): severity + problem type + confirmations + waiting time vs target + asset criticality + previous failed fixes.
5. **Auto-routing** to the right department (cooling → Electrical; no water → Plumbing; dirty → Housekeeping).
6. **Staff accept, work and resolve.** Resolving requires remarks and a repair photo.
7. **The student verifies.** "Yes, it works" closes it; "No, still broken" reopens it with a fresh deadline. **Staff cannot close an issue on their own.**
8. **Asset memory:** every fault, repair and reopen is recorded per asset. Clear rules flag repeat failures (e.g. 3 faults in 90 days) for preventive maintenance.
9. **Hourly SLA checks** escalate overdue issues to administrators automatically.

## Why it is different
Each building block exists somewhere: QR intake in commercial CMMS tools [S41], duplicate suggestion in FixMyStreet [S39], photo proof in Swachhata [S33]. **None of them combine an asset-anchored QR, duplicate consolidation, reporter-verified closure and per-asset failure memory for Indian campuses**, in Hindi and English, on infrastructure that costs almost nothing. See `INNOVATION_AND_IMPACT.md`.

## Measurable impact (what we will measure; no invented numbers)
| Metric | How FixLoop measures it |
|---|---|
| Time to report | `submitMs`: from opening the asset page to submitting |
| Duplicates consolidated | Confirmations merged into existing issues |
| Time to acknowledge / repair | Timestamps on every transition (median, p90) |
| Verified closure rate | Reporter-verified ÷ (verified + auto-closed unverified) |
| Fix quality | Reopen rate per department |
| Repeat-failure assets | Assets that trip a preventive-maintenance rule |

Pilot status and real numbers are tracked honestly in `PILOT_RESULTS.md`. Demo data is always labelled DEMO and excluded from pilot metrics.

## Future scalability
- **Campus to campus:** one config file (`shared/catalog.ts`) defines departments, asset types and SLAs; any institution can deploy its own copy in minutes.
- **Beyond campuses:** the same loop fits government school toilets, PHC equipment, railway-station water booths and municipal hostels. Indian Railways already uses QR codes for complaints and asset monitoring [S34][S35]. This is a future direction, not a current claim.
- **Roadmap:** WhatsApp/SMS notifications (Amazon SNS/Pinpoint), campus-email domain restriction, offline report queue, CSV bulk asset import, and per-institution multi-tenancy.
