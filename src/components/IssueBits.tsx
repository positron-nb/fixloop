import { Link } from 'react-router-dom';
import { AlarmClock, ChevronRight, Info, MapPin, RotateCcw, Users } from 'lucide-react';
import type { IssueRecord } from '../../shared/types';
import { getAssetType } from '../../shared/catalog';
import { slaState } from '../../shared/priority';
import { deptLabel, issueTypeLabel, relTime } from '../lib/format';
import { useLang } from '../lib/i18n';
import { DemoBadge, Icon, PriorityBadge, StatusBadge, cx } from './ui';

export function AssetTypeIcon({ assetType, className = 'size-5' }: { assetType: string; className?: string }) {
  return <Icon name={getAssetType(assetType)?.icon ?? 'Circle'} className={className} />;
}

export function SlaChip({ issue }: { issue: IssueRecord }) {
  const { lang } = useLang();
  if (!['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(issue.status)) return null;
  const s = slaState({ reportedAt: issue.lastOpenedAt, slaDueAt: issue.slaDueAt, resolvedAt: issue.resolvedAt, now: new Date() });
  const tone = s === 'BREACHED' ? 'text-danger' : s === 'AT_RISK' ? 'text-warn' : 'text-muted';
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', tone)}>
      <AlarmClock className="size-3.5" aria-hidden />
      {s === 'BREACHED' ? (lang === 'hi' ? 'समय सीमा पार' : 'Overdue') : lang === 'hi' ? 'लक्ष्य' : 'Due'} {relTime(issue.slaDueAt, lang)}
    </span>
  );
}

export function IssueRow({ issue, to, showAsset = true, trailing }: { issue: IssueRecord; to: string; showAsset?: boolean; trailing?: React.ReactNode }) {
  const { lang } = useLang();
  return (
    <li>
      <Link to={to} className="group flex items-start gap-3 p-4 hover:bg-surface-2/60 transition rounded-2xl">
        <span className="mt-0.5 grid place-items-center size-10 shrink-0 rounded-xl bg-surface-2 text-ink-2">
          <AssetTypeIcon assetType={issue.assetType} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-ink">{issueTypeLabel(issue.assetType, issue.issueType, lang)}</span>
            {issue.isDemo && <DemoBadge />}
          </div>
          {showAsset && (
            <p className="text-sm text-ink-2 truncate flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden />
              {issue.assetName} · {issue.building}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <StatusBadge status={issue.status} />
            <PriorityBadge band={issue.priorityBand} score={issue.priorityScore} />
            {issue.confirmationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                <Users className="size-3.5" aria-hidden />+{issue.confirmationCount}
              </span>
            )}
            {issue.reopenCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-rose font-medium">
                <RotateCcw className="size-3.5" aria-hidden />×{issue.reopenCount}
              </span>
            )}
            <SlaChip issue={issue} />
            <span className="text-xs text-muted">{deptLabel(issue.department, lang)} · {relTime(issue.reportedAt, lang)}</span>
          </div>
        </div>
        {trailing ?? <ChevronRight className="size-4 mt-3 text-muted group-hover:translate-x-0.5 transition" aria-hidden />}
      </Link>
    </li>
  );
}

const PART_LABEL: Record<string, { en: string; hi: string; max: number }> = {
  severity: { en: 'Severity', hi: 'गंभीरता', max: 40 },
  issueType: { en: 'Problem type', hi: 'समस्या का प्रकार', max: 15 },
  confirmations: { en: 'Independent confirmations', hi: 'स्वतंत्र पुष्टियाँ', max: 20 },
  waiting: { en: 'Waiting time vs target', hi: 'प्रतीक्षा समय', max: 20 },
  assetCriticality: { en: 'Asset criticality', hi: 'उपकरण का महत्व', max: 12 },
  reopened: { en: 'Fix failed before', hi: 'पहले मरम्मत विफल', max: 10 },
};

/** "Why this priority?" Every point of the score, shown. */
export function PriorityExplain({ issue }: { issue: IssueRecord }) {
  const { lang, t } = useLang();
  const b = issue.priorityBreakdown as unknown as Record<string, number>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Info className="size-4 text-muted" />
        <span className="text-sm font-semibold">{t('issue.whyPriority')}</span>
        <span className="ml-auto"><PriorityBadge band={issue.priorityBand} score={issue.priorityScore} /></span>
      </div>
      <ul className="space-y-2">
        {Object.entries(PART_LABEL).map(([k, meta]) => (
          <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-ink-2">{lang === 'hi' ? meta.hi : meta.en}</span>
            <span className="tabular-nums font-semibold text-right">+{b?.[k] ?? 0}</span>
            <span className="col-span-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, ((b?.[k] ?? 0) / meta.max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        {lang === 'hi' ? 'कुल अंक 100 तक सीमित। P1 ≥ 70 · P2 ≥ 45 · P3 ≥ 25। कोई AI अनुमान नहीं, केवल नियम।' : 'Total capped at 100. P1 ≥ 70 · P2 ≥ 45 · P3 ≥ 25. Rules only: no AI guesswork.'}
      </p>
    </div>
  );
}
