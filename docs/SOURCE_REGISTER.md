# Source Register

Every factual claim in the FixLoop documentation should trace back to one of these sources. Claims are tagged in other documents as `[S#]`.

**Verification level**
- **Read**: the page or file was opened and read directly during research on 17 Nov 2026.
- **Search**: the claim comes from search-result extracts of the page. The URL is real, but quote the page itself before using the number on a pitch slide.
- **Inspected**: a GitHub repository whose code and metadata were read through the GitHub API.

Access date for all entries: **17 November 2026**.

## Competition sources

| ID | Source | URL / location | Level | Used for |
|---|---|---|---|---|
| S1 | Official problem statement PDF (6 pages), "Campus to Cloud Hackathon sponsored by AWS" | Local file `Campus_to_Cloud_Hackathon_sponsored_by_AWS.docx_1_compressed.pdf` | Read | Rules, deliverables, judging weights, timeline, Google Drive submission |
| S2 | Techfest competition page | https://techfest.org/competitions/aws | Read | Website rules, FAQs, timeline, and how they differ from the PDF |

## AWS sources

| ID | Source | URL | Level | Used for |
|---|---|---|---|---|
| S3 | AWS "What's New": Free Tier credits and 6-month free plan (16 Jul 2025) | https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan | Search | $100 + up to $100 credits; Free vs Paid plan |
| S4 | AWS Accounts: services supported on "Sign up for AWS (new)" | https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html | Read | Amplify, AppSync, Cognito, DynamoDB, Lambda, S3, CloudWatch, CloudFormation, EventBridge and Budgets are listed. IAM Identity Center and AWS Organizations are **not** supported without activating advanced features |
| S5 | AWS Billing: Choosing a plan (Free vs Paid) | https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html | Read | Free plan ends after 6 months or when credits run out; 90-day retention; joining AWS Organizations triggers an automatic upgrade to the Paid plan |
| S6 | AWS serverless decision guide | https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-serverless-service.html | Read | AppSync "best for mobile and web apps with complex data requirements", with real-time subscriptions; API Gateway + Lambda + DynamoDB pattern |
| S7 | Amplify Gen 2 React quickstart | https://docs.amplify.aws/react/start/quickstart/ | Read | Template, Hosting Git deploy, `npx ampx sandbox`, `amplify_outputs.json` |
| S8 | Amplify: configure AWS for local development | https://docs.amplify.aws/react/start/account-setup/ | Read | `AmplifyBackendDeployFullAccess` policy; one-time CDK bootstrap with admin rights |
| S9 | Amplify pricing | https://aws.amazon.com/amplify/pricing/ | Read | 1,000 build min, 5 GB storage, 15 GB transfer per month (free tier, 12 months) |
| S10 | AppSync pricing | https://aws.amazon.com/appsync/pricing/ | Read | 250k operations, 250k real-time updates, 600k connection-minutes per month (12 months); $4 per million operations after that |
| S11 | Amazon Cognito pricing | https://aws.amazon.com/cognito/pricing/ | Search | 10,000 MAU free on Lite/Essentials, no end date |
| S12 | Amplify Gen 2: grant a Lambda function access to the API | https://docs.amplify.aws/javascript/build-a-backend/data/customize-authz/grant-lambda-function-access-to-api | Search | `allow.resource(fn)` pattern, `getAmplifyDataClientConfig` |
| S13 | aws-samples/amplify-vite-react-template (MIT-0, last push 28 Apr 2026) | https://github.com/aws-samples/amplify-vite-react-template | Inspected | Base project layout |
| S14 | aws-samples/serverless-samples (MIT-0, active 13 Nov 2026) | https://github.com/aws-samples/serverless-samples | Inspected | Reference patterns only |
| S15 | aws-samples/serverless-tasks-webapp (MIT-0, last push Feb 2024, Vue) | https://github.com/aws-samples/serverless-tasks-webapp | Inspected | Workshop reference; stale |
| S16 | aws-powertools/powertools-lambda-typescript (MIT-0, active 16 Nov 2026) | https://github.com/aws-powertools/powertools-lambda-typescript | Inspected | Structured logging approach |

## Problem evidence: India

| ID | Source | URL | Level | Claim used |
|---|---|---|---|---|
| S20 | PIB, Ministry of Education: AISHE 2021-22 | https://pib.gov.in/PressReleasePage.aspx?PRID=1999713 | Search | 4.33 crore students enrolled; 1,168 universities, 45,473 colleges, 12,002 standalone institutions registered |
| S21 | UGC (Redressal of Grievances of Students) Regulations 2023, reported by ThePrint | https://theprint.in/india/ugc-rolls-out-new-regulations-for-grievance-redressal-of-students/1518979/ | Search | Regulation notified April 2023; institutions must set up grievance committees and an ombudsperson |
| S22 | Careers360: 228 universities yet to appoint ombudsperson | https://news.careers360.com/ugc-regulations-228-universities-yet-appoint-ombudsperson-notifies-defaulters-list/amp | Search | Compliance gap: 228 universities on UGC's defaulter list |
| S23 | NAAC Criterion 4.4 "Maintenance of Campus Infrastructure" (example institutional SSR document) | https://sjcit.ac.in/wp-content/uploads/2022/11/4.4-Maintenance-of-Campus-Infrastructure.pdf | Search | Institutions must document maintenance systems and spending for accreditation |
| S24 | The News Minute: NLSIU students' overnight protest (fans falling, ceiling, lift, water) | https://www.thenewsminute.com/karnataka/fans-fall-ceiling-crumbles-lift-plunges-nlsiu-students-stage-overnight-protest | Search | Long-pending maintenance complaints; ceiling fans fell in two hostels |
| S25 | Careers360: JNUSU demands repairs after a ceiling fan falls in Tapti hostel | https://news.careers360.com/jnu-jnusu-demand-hostels-infrastructure-repairs-fan-falls-tapti-mahi-mandavi-satya-niketan-incident/amp | Search | Safety-critical asset failure in a hostel |
| S26 | Medical Dialogues: Lady Hardinge Medical College hostel protest (April 2026) | https://medicaldialogues.in/amp/news/education/medical-colleges/insects-in-food-no-acs-waterlogging-lady-hardinge-medical-college-students-protest-over-hostel-conditions-169083 | Search | Repeatedly ignored complaints: unsafe drinking water, washrooms |
| S27 | Free Press Journal: OP Jindal flooded rooms and falling ceilings | https://www.freepressjournal.in/education/flooded-hostel-room-and-falling-ceilings-op-jindal-students-raise-safety-concerns | Search | Private-university infrastructure safety complaints |
| S28 | Free Press Journal: dirty water complaints common in Bhopal colleges | https://www.freepressjournal.in/bhopal/bhopal-news-complaints-of-bad-food-dirty-water-common-in-city-colleges-varsities | Search | Drinking-water complaints recur across colleges |

## Existing solutions and competitors

| ID | Source | URL | Level | Used for |
|---|---|---|---|---|
| S30 | DARPG monthly CPGRAMS report coverage (Oct 2025) | https://www.constructionworld.in/policy-updates-and-economic-news/darpg-report-shows-faster-grievance-redress-in-october-2025/81414 | Search | Average disposal about 15 days for central ministries; 21-day guideline since Aug 2024 |
| S31 | PIB (DARPG) release | https://pib.gov.in/PressReleasePage.aspx?PRID=2226247 | Search | 2025 average CPGRAMS disposal time of 15 days |
| S32 | Swachh Bharat Mission-Urban: Swachhata app page | https://sbmurban.org/swachhtha-app | Search | 2.39 crore complaints posted, 2.24 crore resolved (93.72%) |
| S33 | The Hans India: Swachhata App 2.0 and public toilets | https://www.thehansindia.com/news/cities/bengaluru/swachhata-app-20-using-civic-engagement-to-improve-public-toilet-infrastructure-708469 | Search | Officials upload photo proof of resolution; citizen feedback |
| S34 | DT Next: Southern Railway QR complaint system at eateries | https://www.dtnext.in/news/chennai/qr-code-complaint-system-introduced-in-chennai-railway-division-eateries-852969 | Search | Unique QR per stall links to Rail Madad. This is a precedent for QR-based reporting in India |
| S35 | Railway Board: QR-code-based monitoring of fire extinguishers in coaches (2 Apr 2025) | https://indianrailways.gov.in/railwayboard/uploads/directorate/mec_engg/2025/02_04_2025%20QR%20code%20based%20monitoring%20of%20Fire%20Extinguishers%20in%20Coaches.pdf | Search | Government use of QR tags for asset maintenance tracking |
| S36 | The Week: railway cleanliness complaints up 50% (Jan 2026) | https://www.theweek.in/wire-updates/national/2026/01/07/railway-asks-zones-to-firm-up-grievance-redressal-mechanism-as-cleanliness-complaints-rise-by-50.html | Search | Grievance volumes rising in public infrastructure |
| S37 | iChangeMyCity (Janaagraha), App Store listing | https://apps.apple.com/in/app/ichangemycity/id1239689812 | Search | Routes civic complaints to agencies; community up-voting; English/Hindi/Kannada |
| S38 | Citizen Matters on BBMP Sahaaya | https://citizenmatters.in/?p=5920 | Search | Disputed closures: complaints marked resolved while still unresolved |
| S39 | mySociety: "Stop right there! That's already been reported" (2019) | https://www.mysociety.org/2019/04/24/stop-right-there-thats-already-been-reported/ | Search | FixMyStreet suggests nearby same-category reports before a new one is filed |
| S40 | SocietyWorks: customisable duplicate-suggestion radius (2023) | https://www.societyworks.org/2023/05/25/the-duplicate-report-suggestion-radius-on-fixmystreet-pro-is-now-customisable/ | Search | Duplicate suggestion is a proven pattern in civic tech |
| S41 | UpKeep: QR codes | https://upkeep.com/qr-codes/ | Search | Commercial CMMS scan-to-request; asset auto-attached |
| S42 | MaintainX blog: using QR codes in maintenance | https://www.getmaintainx.com/blog/using-qr-codes-in-maintenance | Search | QR linked to procedures and work orders |
| S43 | Fabrico: CMMS with QR asset tagging (vendor comparison) | https://www.fabrico.io/blog/best-cmms-software-with-qr-code-asset-tagging/ | Search | Pricing is per user per month (USD); vendor bias noted |
| S44 | anshulmodi07/Campus-Complaint-Management-System | https://github.com/anshulmodi07/Campus-Complaint-Management-System | Inspected | See COMPETITOR_ANALYSIS |
| S45 | Jayesh-Kr/Campus-Complaint-Management-System | https://github.com/Jayesh-Kr/Campus-Complaint-Management-System | Inspected | See COMPETITOR_ANALYSIS |
| S46 | trivikramrajurkar/CampusComplaint | https://github.com/trivikramrajurkar/CampusComplaint | Inspected | See COMPETITOR_ANALYSIS |

## Alternative-idea evidence

| ID | Source | URL | Level | Claim used |
|---|---|---|---|---|
| S50 | Medical Dialogues: QR-based OPD registration at 347 hospitals | https://medicaldialogues.in/news/health/hospital-diagnostics/qr-based-opd-registration-cuts-waiting-time-at-347-hospitals-by-46-minutes-107061 | Search | ABHA Scan & Share already deployed for OPD queues |
| S51 | Indian Pharma Post: ABHA Scan & Share reaches 2 crore OPD registrations | https://www.indianpharmapost.com/digitisation/lite/abha-based-scan-and-share-service-facilitates-2-crore-instant-opd-registrations-nationwide-15323 | Search | Scale of the existing queue solution |
| S52 | Careers360: CBSE/NSP framework revision 2026-27 | https://news.careers360.com/cbse-revises-national-scholarship-portal-framework-2026-27-schools-students-key-changes-nsp-merit-welfare-based-schemes | Search | NSP defect-correction rules are changing |
| S53 | Careers360: Bihar post-matric/NMMS scholarships delayed | https://news.careers360.com/bihar-post-matric-nmms-sholarship-late-medhasoft-online-application-portal-verification-students-school-documents-required | Search | Name mismatch is a common rejection cause; no correction window for NMMS |
| S54 | Down To Earth: CAG finds Indore loses 65% of drinking supply | https://www.downtoearth.org.in/water/contaminated-water-crisis-cag-finds-indore-loses-65-of-drinking-supply-bhopal-close-behind | Search | Non-revenue water; 3,530 leakage cases in Bhopal and Indore |
| S55 | Free Press Journal: Mumbai loses 1,400 MLD to leaks and theft | https://www.freepressjournal.in/mumbai/mumbai-loses-1400-million-litres-of-water-daily-to-leakages-thefts | Search | Scale of urban water loss |

## What is NOT in this register

- **No primary interviews or surveys have been conducted yet.** Discovery questions are drafted in `PROBLEM_VALIDATION.md`, and any findings will be logged there with date and count.
- **No institutional partnership exists.** None is claimed.
- **No statistic on average campus repair time in India was found** in public sources. FixLoop's pilot is designed to measure it (see `PILOT_RESULTS.md`).
