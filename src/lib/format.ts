import type { Bilingual, Lang } from '../../shared/catalog';
import { DEPARTMENTS, getAssetType, getIssueType, isDepartmentCode } from '../../shared/catalog';
import type { IssueStatus } from '../../shared/types';
import type { PriorityBand } from '../../shared/priority';

export const STATUS_META: Record<IssueStatus, { label: Bilingual; tone: Tone; icon: string }> = {
  OPEN: { label: { en: 'Open', hi: 'खुली' }, tone: 'info', icon: 'CircleDot' },
  ACKNOWLEDGED: { label: { en: 'Accepted', hi: 'स्वीकृत' }, tone: 'violet', icon: 'UserCheck' },
  IN_PROGRESS: { label: { en: 'In progress', hi: 'काम जारी' }, tone: 'warn', icon: 'Wrench' },
  RESOLVED: { label: { en: 'Awaiting your check', hi: 'पुष्टि बाकी' }, tone: 'cyan', icon: 'ShieldQuestion' },
  REOPENED: { label: { en: 'Reopened', hi: 'दोबारा खुली' }, tone: 'rose', icon: 'RotateCcw' },
  CLOSED: { label: { en: 'Fixed · verified', hi: 'ठीक · पुष्टि हुई' }, tone: 'ok', icon: 'BadgeCheck' },
  CLOSED_UNVERIFIED: { label: { en: 'Closed · not verified', hi: 'बंद · पुष्टि नहीं' }, tone: 'neutral', icon: 'CircleCheck' },
  INVALID: { label: { en: 'Invalid', hi: 'अमान्य' }, tone: 'neutral', icon: 'Ban' },
};

export const BAND_META: Record<PriorityBand, { label: string; tone: Tone }> = {
  P1: { label: 'P1', tone: 'danger' },
  P2: { label: 'P2', tone: 'orange' },
  P3: { label: 'P3', tone: 'warn' },
  P4: { label: 'P4', tone: 'neutral' },
};

export type Tone = 'info' | 'violet' | 'warn' | 'cyan' | 'rose' | 'ok' | 'neutral' | 'danger' | 'orange' | 'brand';

export const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
  warn: 'bg-warn-soft text-warn',
  cyan: 'bg-cyan-soft text-cyan',
  rose: 'bg-rose-soft text-rose',
  ok: 'bg-ok-soft text-ok',
  neutral: 'bg-surface-2 text-ink-2',
  danger: 'bg-danger-soft text-danger',
  orange: 'bg-marigold-soft text-warn',
  brand: 'bg-brand-soft text-brand',
};

export function deptLabel(code: string, lang: Lang): string {
  if (code === 'TRIAGE') return lang === 'hi' ? 'विभाग तय करना बाकी' : 'Needs triage';
  return isDepartmentCode(code) ? DEPARTMENTS[code].label[lang] : code;
}

export function issueTypeLabel(assetType: string, issueType: string, lang: Lang): string {
  return getIssueType(assetType, issueType)?.label[lang] ?? issueType;
}

export function assetTypeLabel(assetType: string, lang: Lang): string {
  return getAssetType(assetType)?.label[lang] ?? assetType;
}

export function relTime(iso: string | null | undefined, lang: Lang, now = Date.now()): string {
  if (!iso) return '';
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

export function dateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function hoursLabel(h: number | null | undefined, lang: Lang): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return '—';
  const hi = lang === 'hi';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} ${hi ? 'मिनट' : 'min'}`;
  if (h < 48) return `${Math.round(h * 10) / 10} ${hi ? 'घंटे' : 'h'}`;
  return `${Math.round((h / 24) * 10) / 10} ${hi ? 'दिन' : 'days'}`;
}

export const pctLabel = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

export const shortId = (id: string) => id.replace(/^demo-/, 'D-').slice(0, 8).toUpperCase();
