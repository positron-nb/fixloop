# Judges' Q&A Preparation

Answer in **≤ 20 seconds**: lead with the claim, then one piece of proof. Never claim numbers we don't have.

## Problem and validation
**1. Why is this problem important?**
India has 4.33 crore higher-education students [S20]. Every campus depends on shared water, washrooms, fans and lights. When they fail, the complaint process is informal and repairs are never verified, which is why we see protests like NLSIU's in 2026 over falling fans and water failures [S24]. It is a daily-life problem with a direct health and safety angle.

**2. How did you validate it?**
Honestly, in two layers. Public evidence: news reports of hostel protests, NAAC's maintenance criterion and UGC's grievance-regulation gaps. Then our own pilot and interviews, with dated results in PILOT_RESULTS.md. We separate assumptions from findings in PROBLEM_VALIDATION.md, and we don't present anything we haven't measured.
*(Update this answer with real pilot numbers before Demo Day.)*

**3. Isn't this just a complaint form?**
A form collects complaints. FixLoop closes the loop: the asset's QR identity, merged duplicates, a priority anyone can audit, mandatory repair evidence, closure **only by the reporter**, and a per-asset failure memory. Remove any one of these and the trust problem comes back.

**4. Who is your user, really: students or administrators?**
Students create the signal; administrators pay attention because of the data. We designed for students first (20 seconds, Hindi, no install) because without reports there is no data. The admin value (SLA, repeat-failure assets, NAAC evidence) is what makes an institution adopt it.

## Differentiation
**5. Why is your solution different from CPGRAMS or Swachhata?**
CPGRAMS handles administrative grievances at national scale; Swachhata handles city sanitation with geo-tagged photos. Neither ties a report to a specific campus asset with a history, merges duplicates, or lets only the reporter close. We borrowed Swachhata's photo-proof idea and FixMyStreet's duplicate suggestion, and adapted both to indoor campus assets.

**6. Commercial CMMS tools already have QR codes. Why build this?**
They're priced per user per month in dollars [S43], they're English-first, and they're built for facility teams, not for verification by the people affected. FixLoop is free to run, bilingual, and makes the student the verifier.

**7. What exactly is innovative?**
The combination, enforced server-side: asset-anchored dedupe with an atomic lock, one-person-one-confirmation, reporter-only closure, explainable priority, and rule-based asset health. We don't claim to have invented QR codes.

## AWS and architecture
**8. Why AWS, and why these services?**
Cognito gives us roles in every token; AppSync gives per-model authorization plus real-time updates for the live dashboard; Lambda enforces the rules; DynamoDB conditional writes make dedupe atomic; private S3 holds evidence; EventBridge runs SLA escalation even when nobody opens the app. All of it is serverless and Free-plan eligible.

**9. Why AppSync and not API Gateway + Lambda?**
API Gateway would need hand-written authorization on every route and a separate WebSocket API for live updates. AppSync gives declarative model rules and subscriptions. We still use Lambda for every write, so the business rules stay in tested code.

**10. How does the infrastructure scale?**
Nothing is provisioned. DynamoDB is on-demand, Lambda scales per request, and AppSync and Cognito are managed. For hundreds of campuses we'd add a `campusId` partition, or deploy one stack per institution for isolation. The only part to change at very large scale is the dashboard, which would move from client-side aggregation to pre-computed stats.

**11. What happens with two reports of the same problem at the same second?**
Both try to create the same lock record (`assetId#issueType`) with a conditional put. DynamoDB lets exactly one succeed; the other becomes a confirmation. It's covered by tests.

**12. Why no AI?**
Priority has to be explainable to students and staff, and we don't have enough historical data to train anything honestly. Rules are transparent and testable. Once pilots generate data, ML-based failure prediction becomes a sensible next step, not before.

**13. Where does the code run, and how fast is it?**
In ap-south-1 (Mumbai), close to users. The phone loads about 155 KB of gzipped JavaScript on first visit, photos are compressed on the device, and the app shell is cached for repeat scans.

## Security
**14. What is the security model?**
Cognito authentication with groups for student, staff per department, and admin. Clients can't write issues at all: every change goes through a Lambda that takes identity from the verified token and checks role, department, assignee and state. S3 is private, students can upload only into their own folder, and photos are validated server-side. The whole model is in AWS_COST_AND_SECURITY.md.

**15. Can a staff member fake a fix?**
No. They can mark it *repaired* only with remarks and a photo, and only the student can close it. If the student doesn't respond within 72 hours, it closes as "unverified", which we count separately.

**16. What if users submit false reports?**
Accounts need a verified email; one person counts once per issue; there's a 10-reports-per-hour limit; and admins can mark an issue invalid with a reason that's kept in the audit trail. Institutions can also restrict sign-up to their email domain.

**17. Can students game priority by marking everything a safety hazard?**
The flag only applies to issue types where safety is plausible (exposed wiring, a wobbling fan, a broken washroom lock), it's visible in the timeline, and confirmations have diminishing returns with a cap.

**18. How do you protect student privacy?**
Staff and other students never see who reported. Timelines say "Student". We collect only an email for login, no phone or roll number. Photos are private, served by 15-minute links, and re-encoded on the phone, which strips location metadata.

## Operations
**19. What happens if an administrator or department fails to respond?**
An hourly EventBridge job checks every open issue against its target (4 h for safety hazards, up to 7 days for minor issues). Missed targets are escalated once, appear in the admin "Overdue" list, and the waiting time raises the issue's priority automatically.

**20. What if staff don't have smartphones or don't use the app?**
A caretaker can share one phone; the queue works on any browser, in Hindi. Worst case, an admin can triage and reassign. We're also measuring this risk in the pilot rather than assuming it away.

**21. What is the operating cost?**
Estimated at about $0–1 a month for a one-hostel pilot and under about $5 a month at ten times that, because nothing runs 24×7. We have a budget alert, and we'll show actual Cost Explorer numbers from the pilot.

**22. How do you measure real impact?**
Every transition is time-stamped, so we compute time to report, time to acknowledge, repair time, verified-closure rate, reopen rate and duplicates merged directly from the system, with demo data excluded and a pre-pilot baseline from observation.

**23. How can another campus adopt it?**
Fork the repo, edit one catalog file (departments, asset types, targets), connect it to Amplify Hosting, invite staff, and print QR labels from the admin page. No servers to manage.

**24. What did you learn while building it?**
Two things. Our offline infrastructure synthesis found a circular dependency between the auth and data stacks, which we fixed by moving functions into their own stack. And writing the rules as tested, pure code first let us prove behaviour such as "staff cannot close an issue" before building any UI.

**25. What's the hardest part you haven't solved?**
Staff adoption and the institutional process: who owns the QR stickers and responds at night. Technology alone can't fix that. Our pilot measures it honestly, and the escalation and analytics are designed to support the people who do the work, not to police them.

**26. What would you build next with more time?**
WhatsApp/SMS updates to the reporter, a campus-email sign-up restriction, an offline report queue for dead zones, bulk CSV asset import, and multi-campus tenancy.

**27. How do you handle Hindi and other languages?**
All UI strings, issue types and the sign-in screens are bilingual today. Adding Marathi or Tamil means adding one dictionary file; the catalog already stores labels per language.

**28. Is it accessible?**
It meets the main WCAG basics: semantic HTML, keyboard focus states, labels on every input, colour never carries meaning alone (status badges have icons and text), reduced-motion support, and large tap targets on phones.
