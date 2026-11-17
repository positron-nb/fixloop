/**
 * DEMO DATA: synthetic records for demonstrations only.
 *
 * Every asset id starts with "DEMO-" and every record has isDemo = true. The admin dashboard
 * shows a DEMO badge and filters demo data out of pilot metrics by default.
 * Never present these numbers as pilot results.
 */
import { getIssueType } from './catalog';
import { reportId } from './dedupe';
import { computePriority, effectiveSeverity, slaDueAt } from './priority';
import type { AssetRecord, IssueEventRecord, IssueRecord, ReportRecord } from './types';
import { reprioritise } from './workflow';

interface Scenario {
  key: string;
  asset: string;
  issueType: string;
  safety?: boolean;
  reportedHoursAgo: number;
  confirmations?: number;
  description?: string;
  ackAfterH?: number;
  startAfterH?: number;
  resolveAfterH?: number;
  /** FIXED / NOT_FIXED_THEN_FIXED (reopened once, fixed second time) / UNVERIFIED (auto-closed) / PENDING (awaiting) */
  verify?: 'FIXED' | 'NOT_FIXED_THEN_FIXED' | 'UNVERIFIED' | 'PENDING';
  rating?: number;
  comment?: string;
  invalid?: string;
  declined?: string;
  staff?: string;
}

const A = (
  id: string,
  name: string,
  nameHi: string,
  assetType: string,
  building: string,
  floor: string,
  locationLabel: string,
  criticality: number,
): AssetRecord => ({
  id,
  name,
  nameHi,
  assetType,
  building,
  floor,
  locationLabel,
  criticality,
  status: 'ACTIVE',
  installedOn: null,
  isDemo: true,
});

export const DEMO_ASSETS: AssetRecord[] = [
  A('DEMO-H4-WC-01', 'Water cooler · Ground floor lobby', 'वाटर कूलर · भूतल लॉबी', 'WATER_COOLER', 'Hostel 4', 'Ground', 'Ground floor, near the main stairs', 3),
  A('DEMO-H4-WR-1F', 'Washroom · 1st floor (east)', 'शौचालय · पहली मंज़िल (पूर्व)', 'WASHROOM', 'Hostel 4', '1', 'First floor, east wing', 2),
  A('DEMO-H4-FAN-CR2', 'Ceiling fan 2 · Common room', 'छत का पंखा 2 · कॉमन रूम', 'CEILING_FAN', 'Hostel 4', 'Ground', 'Common room, second fan from the TV', 2),
  A('DEMO-H4-LT-STR', 'Staircase light · Block B', 'सीढ़ी की लाइट · ब्लॉक बी', 'LIGHT', 'Hostel 4', '2', 'Block B staircase, 2nd landing', 2),
  A('DEMO-H7-WC-01', 'Water cooler · Mess entrance', 'वाटर कूलर · मेस प्रवेश', 'WATER_COOLER', 'Hostel 7 (Girls)', 'Ground', 'Outside the mess entrance', 3),
  A('DEMO-H7-WR-GF', 'Washroom · Ground floor', 'शौचालय · भूतल', 'WASHROOM', 'Hostel 7 (Girls)', 'Ground', 'Ground floor, west corridor', 2),
  A('DEMO-H7-LT-2F', 'Corridor lights · 2nd floor', 'गलियारे की लाइट · दूसरी मंज़िल', 'LIGHT', 'Hostel 7 (Girls)', '2', 'Second floor corridor', 3),
  A('DEMO-AB-CR-101', 'Classroom 101', 'कक्षा 101', 'CLASSROOM', 'Academic Block A', '1', 'Room 101', 2),
  A('DEMO-AB-WIFI-2F', 'Wi-Fi AP · 2nd floor', 'वाई-फ़ाई · दूसरी मंज़िल', 'WIFI_AP', 'Academic Block A', '2', 'Second floor, near the faculty rooms', 2),
  A('DEMO-AB-WR-GF', 'Washroom · Ground floor', 'शौचालय · भूतल', 'WASHROOM', 'Academic Block A', 'Ground', 'Ground floor, beside the lift', 1),
  A('DEMO-LIB-WC-01', 'Water cooler · Reading hall', 'वाटर कूलर · रीडिंग हॉल', 'WATER_COOLER', 'Central Library', 'Ground', 'Reading hall entrance', 2),
  A('DEMO-LIB-LT-01', 'Reading hall lights · Row C', 'रीडिंग हॉल लाइट · पंक्ति C', 'LIGHT', 'Central Library', 'Ground', 'Reading hall, row C', 1),
];

const SCENARIOS: Scenario[] = [
  // The repeat-failure water cooler: four faults in ~60 days, one fix that did not hold.
  { key: 'h4wc-1', asset: 'DEMO-H4-WC-01', issueType: 'NO_WATER', reportedHoursAgo: 52 * 24, confirmations: 2, ackAfterH: 3, startAfterH: 5, resolveAfterH: 20, verify: 'FIXED', rating: 4, staff: 'Ramesh (Plumbing)' },
  { key: 'h4wc-2', asset: 'DEMO-H4-WC-01', issueType: 'NOT_COOLING', reportedHoursAgo: 31 * 24, confirmations: 4, ackAfterH: 6, startAfterH: 24, resolveAfterH: 50, verify: 'FIXED', rating: 3, comment: 'Cold now but compressor is very noisy', staff: 'Suresh (Electrical)' },
  { key: 'h4wc-3', asset: 'DEMO-H4-WC-01', issueType: 'NO_WATER', reportedHoursAgo: 15 * 24, confirmations: 3, ackAfterH: 2, startAfterH: 4, resolveAfterH: 9, verify: 'NOT_FIXED_THEN_FIXED', rating: 2, comment: 'Second fix worked; the first one lasted 1 day', staff: 'Ramesh (Plumbing)' },
  { key: 'h4wc-4', asset: 'DEMO-H4-WC-01', issueType: 'LEAKING', safety: true, reportedHoursAgo: 2.5, confirmations: 3, description: 'Water pooling under the cooler, close to the plug point' },

  { key: 'h4wr-1', asset: 'DEMO-H4-WR-1F', issueType: 'CLOGGED', reportedHoursAgo: 7, confirmations: 2, ackAfterH: 1.5, startAfterH: 3, staff: 'Ramesh (Plumbing)' },
  { key: 'h4wr-2', asset: 'DEMO-H4-WR-1F', issueType: 'UNCLEAN', reportedHoursAgo: 9 * 24, ackAfterH: 2, startAfterH: 2.5, resolveAfterH: 4, verify: 'FIXED', rating: 5, staff: 'Meena (Housekeeping)' },
  { key: 'h4fan', asset: 'DEMO-H4-FAN-CR2', issueType: 'WOBBLING', safety: true, reportedHoursAgo: 3, confirmations: 1, ackAfterH: 0.5, staff: 'Suresh (Electrical)', description: 'Fan shakes a lot at speed 3+' },
  { key: 'h4lt', asset: 'DEMO-H4-LT-STR', issueType: 'EXPOSED_WIRING', reportedHoursAgo: 4 * 24, ackAfterH: 0.4, startAfterH: 0.6, resolveAfterH: 2.5, verify: 'FIXED', rating: 5, staff: 'Suresh (Electrical)' },

  { key: 'h7wc', asset: 'DEMO-H7-WC-01', issueType: 'DIRTY', reportedHoursAgo: 20, confirmations: 5, ackAfterH: 2, startAfterH: 3, resolveAfterH: 14, verify: 'PENDING', staff: 'Meena (Housekeeping)' },
  { key: 'h7wr-1', asset: 'DEMO-H7-WR-GF', issueType: 'DOOR_LOCK', safety: true, reportedHoursAgo: 8 * 24, confirmations: 2, ackAfterH: 1, startAfterH: 2, resolveAfterH: 3.5, verify: 'FIXED', rating: 5, comment: 'Lock fixed the same day. Thank you!', staff: 'Anil (Civil)' },
  { key: 'h7wr-2', asset: 'DEMO-H7-WR-GF', issueType: 'UNCLEAN', reportedHoursAgo: 20 * 24, ackAfterH: 5, startAfterH: 6, resolveAfterH: 8, verify: 'UNVERIFIED', staff: 'Meena (Housekeeping)' },
  { key: 'h7lt', asset: 'DEMO-H7-LT-2F', issueType: 'NOT_WORKING', safety: true, reportedHoursAgo: 6.5, confirmations: 3, description: 'Whole corridor dark after 7 pm' },

  { key: 'ab101-1', asset: 'DEMO-AB-CR-101', issueType: 'PROJECTOR', reportedHoursAgo: 11 * 24, ackAfterH: 3, startAfterH: 20, resolveAfterH: 26, verify: 'FIXED', rating: 4, staff: 'Kiran (IT)' },
  { key: 'ab101-2', asset: 'DEMO-AB-CR-101', issueType: 'PROJECTOR', reportedHoursAgo: 40, confirmations: 1, ackAfterH: 4, staff: 'Kiran (IT)', description: 'HDMI not detected again' },
  { key: 'ab101-3', asset: 'DEMO-AB-CR-101', issueType: 'FURNITURE', reportedHoursAgo: 30, invalid: 'Prank report: furniture checked, no damage found' },
  { key: 'abwifi', asset: 'DEMO-AB-WIFI-2F', issueType: 'NO_CONNECTIVITY', reportedHoursAgo: 5, confirmations: 6, ackAfterH: 0.5, startAfterH: 1, staff: 'Kiran (IT)' },
  { key: 'abwr', asset: 'DEMO-AB-WR-GF', issueType: 'LEAKING_TAP', reportedHoursAgo: 26 },
  { key: 'libwc', asset: 'DEMO-LIB-WC-01', issueType: 'NOT_COOLING', reportedHoursAgo: 25 * 24, confirmations: 1, ackAfterH: 8, startAfterH: 30, resolveAfterH: 60, verify: 'FIXED', rating: 4, staff: 'Suresh (Electrical)' },
  { key: 'liblt', asset: 'DEMO-LIB-LT-01', issueType: 'FLICKERING', reportedHoursAgo: 30, declined: 'These lights are on the UPS line maintained by the IT team' },
];

export interface DemoDataset {
  assets: AssetRecord[];
  issues: IssueRecord[];
  reports: ReportRecord[];
  events: IssueEventRecord[];
}

export function buildDemoDataset(now: Date): DemoDataset {
  const H = 3_600_000;
  const assets = DEMO_ASSETS;
  const issues: IssueRecord[] = [];
  const reports: ReportRecord[] = [];
  const events: IssueEventRecord[] = [];
  let studentN = 0;
  const nextStudent = () => `demo-student-${(studentN++ % 23) + 1}`;

  for (const s of SCENARIOS) {
    const asset = assets.find((a) => a.id === s.asset)!;
    const type = getIssueType(asset.assetType, s.issueType)!;
    const t0 = now.getTime() - s.reportedHoursAgo * H;
    const at = (h: number) => new Date(t0 + h * H).toISOString();
    const id = `demo-${s.key}`;
    const severity = effectiveSeverity(type.defaultSeverity, !!s.safety, type.safetyRelevant);
    const ev = (e: Omit<IssueEventRecord, 'issueId' | 'isDemo' | 'evidenceKeys'> & { evidenceKeys?: string[] }) =>
      events.push({ evidenceKeys: [], ...e, issueId: id, isDemo: true });

    const issue: IssueRecord = {
      id,
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.assetType,
      building: asset.building,
      locationLabel: asset.locationLabel,
      issueType: type.code,
      department: type.department,
      severity,
      status: 'OPEN',
      description: s.description ?? null,
      photoKeys: [],
      ...(() => {
        const p = computePriority({ severity, issueTypeWeight: type.weight, confirmations: 0, hoursWaiting: 0, assetCriticality: asset.criticality, reopenCount: 0 });
        return { priorityScore: p.score, priorityBand: p.band, priorityBreakdown: p.breakdown };
      })(),
      confirmationCount: s.confirmations ?? 0,
      reopenCount: 0,
      escalationLevel: 0,
      assetCriticality: asset.criticality,
      reportedAt: at(0),
      lastOpenedAt: at(0),
      slaDueAt: slaDueAt(at(0), severity),
      slaBreached: false,
      repairEvidenceKeys: [],
      submitMs: 14_000 + ((studentN * 7919) % 26_000),
      isDemo: true,
    };
    const reporter = nextStudent();
    reports.push({ id: reportId(id, reporter), issueId: id, assetId: asset.id, reporterSub: reporter, kind: 'ORIGINAL', photoKeys: [], createdAt: at(0), isDemo: true, note: s.description ?? null, submitMs: issue.submitMs });
    ev({ type: 'REPORTED', toStatus: 'OPEN', actorRole: 'STUDENT', note: `Routed to ${type.department}`, at: at(0) });
    for (let c = 0; c < (s.confirmations ?? 0); c++) {
      const who = nextStudent();
      const ct = at(Math.min(s.reportedHoursAgo, 0.2 + c * 0.7));
      reports.push({ id: reportId(id, who), issueId: id, assetId: asset.id, reporterSub: who, kind: 'CONFIRMATION', photoKeys: [], createdAt: ct, isDemo: true });
      ev({ type: 'CONFIRMED', toStatus: 'OPEN', actorRole: 'STUDENT', note: `Independent confirmation #${c + 1}`, at: ct });
    }

    if (s.invalid) {
      Object.assign(issue, { status: 'INVALID', closedAt: at(3), invalidReason: s.invalid });
      ev({ type: 'MARK_INVALID', fromStatus: 'OPEN', toStatus: 'INVALID', actorRole: 'ADMIN', actorName: 'Estate office (demo)', note: s.invalid, at: at(3) });
    } else if (s.declined) {
      Object.assign(issue, { department: 'TRIAGE', declineReason: s.declined });
      ev({ type: 'DECLINE', fromStatus: 'OPEN', toStatus: 'OPEN', actorRole: 'STAFF', actorName: 'Suresh (Electrical)', note: s.declined, at: at(2) });
    }

    if (s.ackAfterH !== undefined) {
      Object.assign(issue, { status: 'ACKNOWLEDGED', acknowledgedAt: at(s.ackAfterH), assigneeSub: `demo-staff-${s.staff}`, assigneeName: s.staff });
      ev({ type: 'ACCEPT', fromStatus: 'OPEN', toStatus: 'ACKNOWLEDGED', actorRole: 'STAFF', actorName: s.staff, at: at(s.ackAfterH) });
    }
    if (s.startAfterH !== undefined) {
      Object.assign(issue, { status: 'IN_PROGRESS', startedAt: at(s.startAfterH) });
      ev({ type: 'START', fromStatus: 'ACKNOWLEDGED', toStatus: 'IN_PROGRESS', actorRole: 'STAFF', actorName: s.staff, at: at(s.startAfterH) });
    }
    if (s.resolveAfterH !== undefined) {
      const remarks = 'Repaired and tested on site (demo record)';
      if (s.verify === 'NOT_FIXED_THEN_FIXED') {
        const r1 = s.resolveAfterH;
        const reopenAt = r1 + 24;
        ev({ type: 'RESOLVE', fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', actorRole: 'STAFF', actorName: s.staff, note: 'Cleared the inlet valve (demo record)', at: at(r1) });
        ev({ type: 'VERIFY_NOT_FIXED', fromStatus: 'RESOLVED', toStatus: 'REOPENED', actorRole: 'STUDENT', note: 'Stopped again the next morning', at: at(reopenAt) });
        ev({ type: 'ACCEPT', fromStatus: 'REOPENED', toStatus: 'ACKNOWLEDGED', actorRole: 'STAFF', actorName: s.staff, at: at(reopenAt + 1) });
        ev({ type: 'RESOLVE', fromStatus: 'ACKNOWLEDGED', toStatus: 'RESOLVED', actorRole: 'STAFF', actorName: s.staff, note: 'Replaced the float valve (demo record)', at: at(reopenAt + 6) });
        Object.assign(issue, { reopenCount: 1, lastOpenedAt: at(reopenAt), slaDueAt: slaDueAt(at(reopenAt), severity), status: 'RESOLVED', resolvedAt: at(reopenAt + 6), resolutionRemarks: 'Replaced the float valve (demo record)' });
      } else {
        Object.assign(issue, { status: 'RESOLVED', resolvedAt: at(s.resolveAfterH), resolutionRemarks: remarks });
        ev({ type: 'RESOLVE', fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', actorRole: 'STAFF', actorName: s.staff, note: remarks, at: at(s.resolveAfterH) });
      }
      const resolvedH = (new Date(issue.resolvedAt!).getTime() - t0) / H;
      if (s.verify === 'FIXED' || s.verify === 'NOT_FIXED_THEN_FIXED') {
        const vt = at(resolvedH + 3);
        Object.assign(issue, { status: 'CLOSED', closedAt: vt, verificationOutcome: 'FIXED', verificationRating: s.rating ?? null, verificationComment: s.comment ?? null });
        ev({ type: 'VERIFY_FIXED', fromStatus: 'RESOLVED', toStatus: 'CLOSED', actorRole: 'STUDENT', note: s.comment ?? null, at: vt });
      } else if (s.verify === 'UNVERIFIED') {
        const vt = at(resolvedH + 72);
        Object.assign(issue, { status: 'CLOSED_UNVERIFIED', closedAt: vt });
        ev({ type: 'AUTO_CLOSE', fromStatus: 'RESOLVED', toStatus: 'CLOSED_UNVERIFIED', actorRole: 'SYSTEM', note: 'No reporter response within 72 hours', at: vt });
      }
    }

    // SLA breach + escalation for issues still waiting past their target.
    if (!issue.resolvedAt && issue.status !== 'INVALID' && now.getTime() > new Date(issue.slaDueAt).getTime()) {
      Object.assign(issue, { slaBreached: true, escalationLevel: 1 });
      ev({ type: 'ESCALATED', fromStatus: issue.status, toStatus: issue.status, actorRole: 'SYSTEM', note: 'Service target missed. Escalated to administrators (level 1)', at: issue.slaDueAt });
    }

    Object.assign(issue, reprioritise(issue, type, now));
    issues.push(issue);
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return { assets, issues, reports, events };
}
