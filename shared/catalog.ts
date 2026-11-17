/**
 * FixLoop catalog: departments, asset types and issue types.
 *
 * This is the single source of truth for routing (issue type → department),
 * default severity, priority weight and whether repair evidence is mandatory.
 * Another campus adopts FixLoop by editing this file (see docs/ARCHITECTURE.md).
 */

export type Lang = 'en' | 'hi';
export type Bilingual = { en: string; hi: string };

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DEPARTMENT_CODES = ['ELECTRICAL', 'PLUMBING', 'CIVIL', 'HOUSEKEEPING', 'IT'] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

/** Issues declined by staff or with an unclear owner wait here for an admin. */
export const TRIAGE = 'TRIAGE' as const;
export type RoutingDepartment = DepartmentCode | typeof TRIAGE;

export interface Department {
  code: DepartmentCode;
  label: Bilingual;
  /** Cognito group whose members are staff of this department. */
  group: `DEPT_${DepartmentCode}`;
}

export const DEPARTMENTS: Record<DepartmentCode, Department> = {
  ELECTRICAL: { code: 'ELECTRICAL', label: { en: 'Electrical', hi: 'विद्युत' }, group: 'DEPT_ELECTRICAL' },
  PLUMBING: { code: 'PLUMBING', label: { en: 'Plumbing & Water', hi: 'प्लंबिंग व जल' }, group: 'DEPT_PLUMBING' },
  CIVIL: { code: 'CIVIL', label: { en: 'Civil & Carpentry', hi: 'सिविल व बढ़ईगीरी' }, group: 'DEPT_CIVIL' },
  HOUSEKEEPING: { code: 'HOUSEKEEPING', label: { en: 'Housekeeping', hi: 'स्वच्छता' }, group: 'DEPT_HOUSEKEEPING' },
  IT: { code: 'IT', label: { en: 'IT & Network', hi: 'आईटी व नेटवर्क' }, group: 'DEPT_IT' },
};

export const ROLE_GROUPS = ['ADMIN', 'STAFF', 'STUDENT'] as const;
export type RoleGroup = (typeof ROLE_GROUPS)[number];
export const DEPARTMENT_GROUPS = DEPARTMENT_CODES.map((c) => DEPARTMENTS[c].group);
export const ALL_GROUPS: string[] = [...ROLE_GROUPS, ...DEPARTMENT_GROUPS];

export interface IssueType {
  code: string;
  label: Bilingual;
  department: DepartmentCode;
  defaultSeverity: Severity;
  /** 0–15 points in the priority score. */
  weight: number;
  /** If true, a reporter may flag it as a safety hazard, which raises severity to CRITICAL. */
  safetyRelevant: boolean;
  /** If true, staff must attach a photo when resolving. */
  evidenceRequired: boolean;
  /** "Other" types are free text and are never auto-merged as duplicates. */
  freeform?: boolean;
}

export interface AssetType {
  code: string;
  label: Bilingual;
  icon: string; // lucide icon name, resolved in the UI
  issueTypes: IssueType[];
}

const other = (department: DepartmentCode): IssueType => ({
  code: 'OTHER',
  label: { en: 'Something else', hi: 'कुछ और' },
  department,
  defaultSeverity: 'MEDIUM',
  weight: 2,
  safetyRelevant: true,
  evidenceRequired: true,
  freeform: true,
});

export const ASSET_TYPES: AssetType[] = [
  {
    code: 'WATER_COOLER',
    label: { en: 'Water cooler', hi: 'वाटर कूलर' },
    icon: 'GlassWater',
    issueTypes: [
      { code: 'NO_WATER', label: { en: 'No water', hi: 'पानी नहीं आ रहा' }, department: 'PLUMBING', defaultSeverity: 'HIGH', weight: 10, safetyRelevant: false, evidenceRequired: true },
      { code: 'NOT_COOLING', label: { en: 'Water not cold', hi: 'पानी ठंडा नहीं' }, department: 'ELECTRICAL', defaultSeverity: 'MEDIUM', weight: 6, safetyRelevant: false, evidenceRequired: true },
      { code: 'LEAKING', label: { en: 'Leaking / water on floor', hi: 'रिसाव / फर्श पर पानी' }, department: 'PLUMBING', defaultSeverity: 'MEDIUM', weight: 8, safetyRelevant: true, evidenceRequired: true },
      { code: 'DIRTY', label: { en: 'Dirty / unhygienic', hi: 'गंदा / अस्वच्छ' }, department: 'HOUSEKEEPING', defaultSeverity: 'HIGH', weight: 10, safetyRelevant: false, evidenceRequired: true },
      { code: 'ELECTRIC_SHOCK', label: { en: 'Electric shock / sparking', hi: 'करंट / चिंगारी' }, department: 'ELECTRICAL', defaultSeverity: 'CRITICAL', weight: 15, safetyRelevant: true, evidenceRequired: true },
      other('PLUMBING'),
    ],
  },
  {
    code: 'WASHROOM',
    label: { en: 'Washroom', hi: 'शौचालय' },
    icon: 'Bath',
    issueTypes: [
      { code: 'NO_WATER', label: { en: 'No water', hi: 'पानी नहीं आ रहा' }, department: 'PLUMBING', defaultSeverity: 'HIGH', weight: 10, safetyRelevant: false, evidenceRequired: true },
      { code: 'CLOGGED', label: { en: 'Blocked / overflowing', hi: 'जाम / ओवरफ्लो' }, department: 'PLUMBING', defaultSeverity: 'HIGH', weight: 10, safetyRelevant: false, evidenceRequired: true },
      { code: 'LEAKING_TAP', label: { en: 'Leaking tap or flush', hi: 'नल या फ्लश टपक रहा' }, department: 'PLUMBING', defaultSeverity: 'LOW', weight: 4, safetyRelevant: false, evidenceRequired: true },
      { code: 'UNCLEAN', label: { en: 'Not cleaned', hi: 'सफाई नहीं हुई' }, department: 'HOUSEKEEPING', defaultSeverity: 'MEDIUM', weight: 8, safetyRelevant: false, evidenceRequired: true },
      { code: 'DOOR_LOCK', label: { en: 'Broken door or lock', hi: 'दरवाज़ा या कुंडी टूटी' }, department: 'CIVIL', defaultSeverity: 'HIGH', weight: 10, safetyRelevant: true, evidenceRequired: true },
      { code: 'LIGHT_OUT', label: { en: 'Light not working', hi: 'लाइट नहीं जल रही' }, department: 'ELECTRICAL', defaultSeverity: 'MEDIUM', weight: 6, safetyRelevant: true, evidenceRequired: true },
      other('HOUSEKEEPING'),
    ],
  },
  {
    code: 'CEILING_FAN',
    label: { en: 'Ceiling fan', hi: 'छत का पंखा' },
    icon: 'Fan',
    issueTypes: [
      { code: 'NOT_WORKING', label: { en: 'Not working', hi: 'नहीं चल रहा' }, department: 'ELECTRICAL', defaultSeverity: 'MEDIUM', weight: 6, safetyRelevant: false, evidenceRequired: true },
      { code: 'WOBBLING', label: { en: 'Wobbling / loose / noisy', hi: 'हिल रहा / ढीला / आवाज़' }, department: 'ELECTRICAL', defaultSeverity: 'HIGH', weight: 12, safetyRelevant: true, evidenceRequired: true },
      { code: 'REGULATOR', label: { en: 'Speed regulator faulty', hi: 'रेगुलेटर खराब' }, department: 'ELECTRICAL', defaultSeverity: 'LOW', weight: 3, safetyRelevant: false, evidenceRequired: true },
      other('ELECTRICAL'),
    ],
  },
  {
    code: 'LIGHT',
    label: { en: 'Light / lighting', hi: 'लाइट' },
    icon: 'Lightbulb',
    issueTypes: [
      { code: 'NOT_WORKING', label: { en: 'Not working', hi: 'नहीं जल रही' }, department: 'ELECTRICAL', defaultSeverity: 'MEDIUM', weight: 6, safetyRelevant: true, evidenceRequired: true },
      { code: 'FLICKERING', label: { en: 'Flickering', hi: 'टिमटिमा रही' }, department: 'ELECTRICAL', defaultSeverity: 'LOW', weight: 3, safetyRelevant: false, evidenceRequired: true },
      { code: 'EXPOSED_WIRING', label: { en: 'Exposed wiring', hi: 'खुले तार' }, department: 'ELECTRICAL', defaultSeverity: 'CRITICAL', weight: 15, safetyRelevant: true, evidenceRequired: true },
      other('ELECTRICAL'),
    ],
  },
  {
    code: 'WIFI_AP',
    label: { en: 'Wi-Fi access point', hi: 'वाई-फ़ाई' },
    icon: 'Wifi',
    issueTypes: [
      { code: 'NO_CONNECTIVITY', label: { en: 'No connection', hi: 'कनेक्शन नहीं' }, department: 'IT', defaultSeverity: 'HIGH', weight: 8, safetyRelevant: false, evidenceRequired: false },
      { code: 'SLOW', label: { en: 'Very slow', hi: 'बहुत धीमा' }, department: 'IT', defaultSeverity: 'LOW', weight: 3, safetyRelevant: false, evidenceRequired: false },
      { ...other('IT'), safetyRelevant: false, evidenceRequired: false },
    ],
  },
  {
    code: 'CLASSROOM',
    label: { en: 'Classroom / lab', hi: 'कक्षा / लैब' },
    icon: 'Presentation',
    issueTypes: [
      { code: 'PROJECTOR', label: { en: 'Projector / AV fault', hi: 'प्रोजेक्टर खराब' }, department: 'IT', defaultSeverity: 'MEDIUM', weight: 6, safetyRelevant: false, evidenceRequired: true },
      { code: 'FURNITURE', label: { en: 'Broken furniture', hi: 'टूटा फर्नीचर' }, department: 'CIVIL', defaultSeverity: 'LOW', weight: 4, safetyRelevant: true, evidenceRequired: true },
      { code: 'AC_FAULT', label: { en: 'AC not working', hi: 'एसी नहीं चल रहा' }, department: 'ELECTRICAL', defaultSeverity: 'MEDIUM', weight: 5, safetyRelevant: false, evidenceRequired: true },
      other('CIVIL'),
    ],
  },
];

const assetTypeIndex = new Map(ASSET_TYPES.map((t) => [t.code, t]));

export function getAssetType(code: string): AssetType | undefined {
  return assetTypeIndex.get(code);
}

export function getIssueType(assetTypeCode: string, issueTypeCode: string): IssueType | undefined {
  return getAssetType(assetTypeCode)?.issueTypes.find((i) => i.code === issueTypeCode);
}

export function isDepartmentCode(v: unknown): v is DepartmentCode {
  return typeof v === 'string' && (DEPARTMENT_CODES as readonly string[]).includes(v);
}

export function departmentForGroup(group: string): DepartmentCode | undefined {
  const code = group.startsWith('DEPT_') ? group.slice(5) : '';
  return isDepartmentCode(code) ? code : undefined;
}

/** Service-level targets in hours, by effective severity. */
export const SLA_HOURS: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

/** Reporter has this long to verify a fix before it auto-closes as unverified. */
export const VERIFICATION_WINDOW_HOURS = 72;

export const SEVERITY_LABEL: Record<Severity, Bilingual> = {
  CRITICAL: { en: 'Safety hazard', hi: 'सुरक्षा खतरा' },
  HIGH: { en: 'Not working', hi: 'काम नहीं कर रहा' },
  MEDIUM: { en: 'Partly working', hi: 'आंशिक रूप से खराब' },
  LOW: { en: 'Minor', hi: 'मामूली' },
};
