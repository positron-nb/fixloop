# Demo Script: 3 minutes, live product

**Setup before going on stage**
- Phone A ("student"), signed in as a student, Hindi toggle ready. Phone B or laptop tab ("staff"), signed in as Plumbing staff. Laptop on the projector: **Admin dashboard** with *Include demo data* ticked (the banner says DEMO).
- A printed FixLoop QR sticker on a real bottle or cooler prop: asset **DEMO-H4-WC-01** (the repeat-failure cooler from the demo dataset). A second sticker for a "clean" asset.
- Rehearse with a stopwatch. Every action below is the real deployed app; no slides except the last 15 seconds.

| Time | On screen | Say (≈ what to say) |
|---|---|---|
| **0:00–0:20** | Photo or video of a real broken campus cooler or washroom; then hold up the QR sticker | "Every Indian campus has this cooler. Ten students complain on WhatsApp, nobody tracks it, someone says *fixed*, and next week it's broken again. In 2026 students at NLSIU protested overnight over falling fans and water failures. The problem isn't reporting. It's that **the loop never closes**." |
| **0:20–0:50** | Phone A scans the sticker → asset page opens (Hindi) and already lists "Leaking · 4 reports" | "I scan the cooler. No app install, no hunting for the right office. FixLoop knows exactly which cooler this is and shows what's already reported, in Hindi or English. Mine is a different problem." Tap **Report a different problem → "No water"**, add a photo, submit. |
| **0:50–1:20** | Result: "Routed to Plumbing · P2". Phone B scans the same sticker → "No water · 1 report" → **Same problem: confirm** → "Added your confirmation: no duplicate" | "It's routed to Plumbing automatically with a service target. Now a second student has the same problem. FixLoop **doesn't create a duplicate**. It adds a verified confirmation, and the priority goes up." Open the issue → **Why this priority?**: "Every point is explained. No black-box AI." |
| **1:20–1:50** | Staff phone: the issue appears live at the top of the Plumbing queue → Accept → Start → Mark repaired (remarks + repair photo) | "The plumber's queue updated live. Accept, start, and to mark it repaired he **must** write what he did and upload a photo. The server enforces that, not just the app." |
| **1:50–2:20** | Student phone: "Fixed? Please verify" → tap **"No, still broken"** → status *Reopened*; staff queue shows it reopened | "Here's the difference. The plumber can't close this ticket. Only the student who reported it can. I say it's *still broken*, and it reopens with a fresh deadline and higher priority. That's how you stop fake closures." |
| **2:20–2:45** | Admin dashboard: live KPIs; **Repeat-failure assets** → DEMO-H4-WC-01 (4 faults in 60 days, health score); department table; Overdue list | "The warden sees everything live: overdue issues auto-escalated, each department's response time, verified-closure rate. This cooler has failed four times in 60 days, so FixLoop recommends preventive maintenance instead of a fifth patch. (These numbers are labelled demo data. Our pilot numbers are in the submission.)" |
| **2:45–3:00** | One architecture slide (from `ARCHITECTURE.md`) | "It's fully serverless on AWS in Mumbai: Cognito, AppSync, Lambda, DynamoDB, private S3 and an EventBridge SLA engine. It costs about nothing at campus scale, and any of India's 58,000 colleges can deploy it from one config file. FixLoop: **scan it, report it, track it, verify the fix.**" |

## Backup plan
- **Network failure:** a pre-recorded 2:50 screen capture of the same flow (record it on 16 Dec from the production URL).
- **Camera fails to scan:** type the code under the QR (`DEMO-H4-WC-01`). This is a real feature, so mention it.
- **Real-time is slow:** pull down to refresh, or open the issue directly from the result screen's "Track" link.

## Demo-data honesty line (use it)
> "Dashboard numbers marked DEMO are synthetic, so you can see the analytics. Real pilot numbers are separate and labelled."

## Video version (Round 1 submission, under 3:00)
Same structure, recorded from the **production URL** with two phones (screen recordings) + laptop. Add burned-in captions in English (and key lines in Hindi). End card: live URL, GitHub repo, team name and Builder Center aliases.
