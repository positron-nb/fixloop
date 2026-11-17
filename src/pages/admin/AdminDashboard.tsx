import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, AlertTriangle, BadgeCheck, Copy, Gauge, MessageSquareQuote, Radio, Timer, Wrench, Zap } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { BarList, Heatmap, KpiTile, SegmentBar, TrendChart } from '../../components/charts';
import { AssetTypeIcon, IssueRow } from '../../components/IssueBits';
import { Card, ErrorBox, SectionTitle, Skeleton, cx } from '../../components/ui';
import { deptLabel, hoursLabel, issueTypeLabel, pctLabel } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import { useCampusData, useDemoToggle } from '../../lib/useCampusData';
import { campusAnalytics } from '../../../shared/analytics';
import { repeatFailureAssets } from '../../../shared/assetIntel';
import { DEPARTMENT_CODES, TRIAGE } from '../../../shared/catalog';

export function DemoToggle({ value, onChange, hasDemo }: { value: boolean; onChange: (v: boolean) => void; hasDemo: boolean }) {
  const { t } = useLang();
  if (!hasDemo) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-2 cursor-pointer select-none">
      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {t('admin.includeDemo')}
    </label>
  );
}

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [includeDemo, setIncludeDemo] = useDemoToggle();
  const { data, error } = useCampusData(includeDemo);
  const now = useMemo(() => new Date(), [data]);

  const a = useMemo(() => (data ? campusAnalytics(data.issues, data.assets.length, now) : null), [data, now]);
  const repeat = useMemo(() => (data ? repeatFailureAssets(data.assets.map((x) => x.id), data.issues, now).slice(0, 5) : []), [data, now]);
  const breached = useMemo(
    () => (data ? data.issues.filter((i) => ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && now.getTime() > new Date(i.slaDueAt).getTime()).sort((x, y) => y.priorityScore - x.priorityScore) : []),
    [data, now],
  );

  if (error) return <Page><ErrorBox message={error} /></Page>;
  if (!data || !a) {
    return (
      <Page>
        <Skeleton className="h-8 w-72" />
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-6 gap-3">{[0, 1, 2, 3, 4, 5].map((k) => <Skeleton key={k} className="h-24" />)}</div>
        <Skeleton className="h-64 mt-4" />
      </Page>
    );
  }

  const assetName = new Map(data.assets.map((x) => [x.id, x]));
  const statusSegments = [
    { key: 'OPEN', label: lang === 'hi' ? 'खुली' : 'Open', value: a.byStatus.OPEN + a.byStatus.REOPENED, color: 'var(--info)' },
    { key: 'ACK', label: lang === 'hi' ? 'स्वीकृत' : 'Accepted', value: a.byStatus.ACKNOWLEDGED, color: 'var(--violet)' },
    { key: 'IP', label: lang === 'hi' ? 'काम जारी' : 'In progress', value: a.byStatus.IN_PROGRESS, color: 'var(--marigold)' },
    { key: 'RES', label: lang === 'hi' ? 'पुष्टि बाकी' : 'Awaiting verification', value: a.byStatus.RESOLVED, color: 'var(--cyan)' },
    { key: 'CL', label: lang === 'hi' ? 'ठीक · पुष्टि' : 'Verified fixed', value: a.byStatus.CLOSED, color: 'var(--ok)' },
    { key: 'CU', label: lang === 'hi' ? 'बिना पुष्टि बंद' : 'Closed unverified', value: a.byStatus.CLOSED_UNVERIFIED, color: 'var(--line-strong)' },
  ];
  const deptRows = a.byDepartment.filter((d) => d.total > 0 || d.department !== TRIAGE);
  const buildings = a.byBuilding.map((b) => b.building).slice(0, 8);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="mt-0.5 text-sm text-ink-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-ok text-xs font-semibold"><Radio className="size-3.5" /> {t('admin.live')}</span>
            {lang === 'hi' ? `${a.totals.assets} उपकरण · ${a.totals.issues} समस्याएँ` : `${a.totals.assets} assets · ${a.totals.issues} issues`}
          </p>
        </div>
        <DemoToggle value={includeDemo} onChange={setIncludeDemo} hasDemo={data.hasDemo} />
      </div>

      {includeDemo && data.hasDemo && (
        <p className="mt-3 rounded-xl border border-dashed border-warn/60 bg-warn-soft px-3 py-2 text-xs text-warn font-medium">
          {lang === 'hi' ? 'डेमो डेटा शामिल है। ये पायलट परिणाम नहीं हैं।' : 'Includes DEMO DATA. These numbers are synthetic, not pilot results.'}
        </p>
      )}
      {!includeDemo && !data.hasReal && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
          {lang === 'hi' ? 'अभी कोई असली रिपोर्ट नहीं। पायलट शुरू होने पर आँकड़े यहाँ दिखेंगे।' : 'No real reports yet. Pilot numbers appear here as soon as students start reporting.'}
          {data.hasDemo && (
            <button className="ml-2 font-semibold text-brand" onClick={() => setIncludeDemo(true)}>
              {lang === 'hi' ? 'डेमो डेटा देखें' : 'View demo data'}
            </button>
          )}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile icon={<Wrench className="size-4" />} label={lang === 'hi' ? 'खुली समस्याएँ' : 'Active issues'} value={String(a.totals.active)} sub={`${a.priority.P1} × P1 · ${a.totals.awaitingVerification} ${lang === 'hi' ? 'पुष्टि बाकी' : 'awaiting check'}`} />
        <KpiTile icon={<AlarmClock className="size-4" />} alert={breached.length > 0} label={lang === 'hi' ? 'समय सीमा पार' : 'Overdue now'} value={String(breached.length)} sub={lang === 'hi' ? 'स्वतः ऊपर भेजी गईं' : 'Auto-escalated hourly'} />
        <KpiTile icon={<Zap className="size-4" />} label={lang === 'hi' ? 'स्वीकृति समय (माध्यिका)' : 'Median time to accept'} value={hoursLabel(a.timing.medianAckHours, lang)} />
        <KpiTile icon={<Timer className="size-4" />} label={lang === 'hi' ? 'मरम्मत समय (माध्यिका)' : 'Median repair time'} value={hoursLabel(a.timing.medianResolveHours, lang)} sub={`p90 ${hoursLabel(a.timing.p90ResolveHours, lang)}`} />
        <KpiTile icon={<BadgeCheck className="size-4" />} label={lang === 'hi' ? 'छात्र-पुष्टि दर' : 'Reporter-verified closures'} value={pctLabel(a.verification.verificationRatePct)} sub={`${a.totals.verifiedClosed} ${lang === 'hi' ? 'पुष्टि' : 'verified'} · ${a.totals.closedUnverified} ${lang === 'hi' ? 'बिना पुष्टि' : 'unverified'}`} />
        <KpiTile icon={<Copy className="size-4" />} label={lang === 'hi' ? 'दोहराव रोके गए' : 'Duplicates consolidated'} value={String(a.totals.duplicatesConsolidated)} sub={`${a.totals.reports} ${lang === 'hi' ? 'कुल रिपोर्ट' : 'reports → '} ${a.totals.issues} ${lang === 'hi' ? 'समस्याएँ' : 'issues'}`} />
      </div>

      <Card className="mt-4 p-5">
        <SectionTitle>{lang === 'hi' ? 'स्थिति पाइपलाइन' : 'Status pipeline'}</SectionTitle>
        <SegmentBar segments={statusSegments} />
      </Card>

      <div className="mt-4 grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle>{lang === 'hi' ? 'पिछले 14 दिन' : 'Last 14 days'}</SectionTitle>
          <TrendChart data={a.trend} labels={{ reported: lang === 'hi' ? 'नई समस्याएँ' : 'Reported', resolved: lang === 'hi' ? 'मरम्मत हुई' : 'Repaired' }} />
        </Card>
        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'खुली समस्याओं की प्राथमिकता' : 'Priority of active issues'}</SectionTitle>
          <BarList
            rows={(['P1', 'P2', 'P3', 'P4'] as const).map((p) => ({ key: p, label: <span className="font-semibold">{p}</span>, value: a.priority[p] }))}
            max={Math.max(1, a.totals.active)}
          />
          <p className="mt-4 text-xs text-muted">{lang === 'hi' ? 'P1 ≥ 70 अंक। नियम-आधारित, हर अंक समझाया गया।' : 'P1 ≥ 70 points. Rule-based; every point explained on the issue.'}</p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <SectionTitle>{lang === 'hi' ? 'विभाग का प्रदर्शन' : 'Department performance'}</SectionTitle>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="font-medium py-2 px-1">{lang === 'hi' ? 'विभाग' : 'Department'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'खुली' : 'Active'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'समय सीमा पार' : 'Overdue'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'स्वीकृति' : 'Accept (median)'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'मरम्मत' : 'Repair (median)'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'लक्ष्य पूरा' : 'Target met'}</th>
                <th className="font-medium py-2 px-1 text-right">{lang === 'hi' ? 'दोबारा खुली' : 'Reopen rate'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {deptRows.map((d) => (
                <tr key={d.department}>
                  <td className="py-2.5 px-1 font-medium">{deptLabel(d.department, lang)}</td>
                  <td className="py-2.5 px-1 text-right tabular-nums">{d.active}</td>
                  <td className={cx('py-2.5 px-1 text-right tabular-nums', d.breachedNow > 0 && 'text-danger font-semibold')}>
                    {d.breachedNow > 0 && <AlertTriangle className="inline size-3.5 mr-1 -mt-0.5" aria-label="overdue" />}
                    {d.breachedNow}
                  </td>
                  <td className="py-2.5 px-1 text-right tabular-nums">{hoursLabel(d.medianAckHours, lang)}</td>
                  <td className="py-2.5 px-1 text-right tabular-nums">{hoursLabel(d.medianResolveHours, lang)}</td>
                  <td className="py-2.5 px-1 text-right tabular-nums">{pctLabel(d.slaMetPct)}</td>
                  <td className="py-2.5 px-1 text-right tabular-nums">{pctLabel(d.reopenRatePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'हॉटस्पॉट: भवन × विभाग' : 'Hotspots: building × department'}</SectionTitle>
          {buildings.length ? (
            <Heatmap rows={buildings} cols={[...DEPARTMENT_CODES]} cells={a.hotspots.map((h) => ({ row: h.building, col: h.department, value: h.count }))} colLabel={(c) => deptLabel(c, lang).split(' ')[0]} />
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'सबसे आम समस्याएँ' : 'Most common problems'}</SectionTitle>
          <BarList
            rows={a.byCategory.slice(0, 7).map((c) => ({
              key: `${c.assetType}/${c.issueType}`,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <AssetTypeIcon assetType={c.assetType} className="size-3.5 text-muted" />
                  {issueTypeLabel(c.assetType, c.issueType, lang)}
                </span>
              ),
              value: c.count,
            }))}
          />
        </Card>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'बार-बार खराब होने वाले उपकरण' : 'Repeat-failure assets'}</SectionTitle>
          {repeat.length === 0 ? (
            <p className="text-sm text-muted">{lang === 'hi' ? 'कोई उपकरण नियम सीमा पार नहीं कर रहा।' : 'No asset crosses a preventive-maintenance rule yet.'}</p>
          ) : (
            <ul className="divide-y divide-line">
              {repeat.map((h) => {
                const asset = assetName.get(h.assetId);
                return (
                  <li key={h.assetId}>
                    <Link to={`/a/${h.assetId}`} className="flex items-center gap-3 py-3 hover:text-brand">
                      <span className="grid place-items-center size-9 rounded-xl bg-danger-soft text-danger">
                        <AssetTypeIcon assetType={asset?.assetType ?? ''} className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{asset?.name ?? h.assetId}</p>
                        <p className="text-xs text-muted">
                          {h.faultsInLast90Days} {lang === 'hi' ? 'खराबियाँ / 90 दिन' : 'faults / 90 days'} · {h.reopenTotal} {lang === 'hi' ? 'दोबारा खुली' : 'reopens'}
                          {h.mtbfDays !== null && ` · MTBF ${h.mtbfDays}d`}
                        </p>
                      </div>
                      <span className="text-right">
                        <span className="block text-lg font-bold tabular-nums">{h.healthScore}</span>
                        <span className="block text-[10px] uppercase tracking-wide text-muted">{lang === 'hi' ? 'स्वास्थ्य' : 'health'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            {lang === 'hi' ? 'नियम: 90 दिनों में ≥3 खराबी · 60 दिनों में एक ही खराबी ≥2 बार · ≥2 बार दोबारा खुली · औसत अंतर ≤14 दिन।' : 'Rules: ≥3 faults in 90 days · same fault ≥2× in 60 days · ≥2 reopens · mean gap ≤14 days. No predictive claims.'}
          </p>
        </Card>
        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'छात्रों की प्रतिक्रिया' : 'Student feedback'}</SectionTitle>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold tabular-nums">{a.verification.avgRating ?? '—'}</span>
            <span className="text-sm text-ink-2 pb-1">/ 5 · {a.verification.ratings} {lang === 'hi' ? 'रेटिंग' : 'ratings'}</span>
            <span className="ml-auto text-sm text-ink-2 pb-1">
              {lang === 'hi' ? 'दोबारा खुलने की दर' : 'Reopen rate'} <b className="text-ink">{pctLabel(a.verification.reopenRatePct)}</b>
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {a.verification.recentComments.map((c) => (
              <li key={c.issueId} className="flex gap-2 text-sm">
                <MessageSquareQuote className="size-4 shrink-0 mt-0.5 text-muted" />
                <Link to={`/issues/${c.issueId}`} className="text-ink-2 hover:text-ink">
                  “{c.comment}” {c.rating ? <span className="text-marigold">{'★'.repeat(c.rating)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="mt-4">
        <Card>
          <div className="px-5 pt-5">
            <SectionTitle right={<Link to="/admin/issues" className="text-xs font-semibold text-brand">{lang === 'hi' ? 'सभी समस्याएँ' : 'All issues'} →</Link>}>
              <span className="inline-flex items-center gap-1.5"><Gauge className="size-4" /> {lang === 'hi' ? 'समय सीमा पार (ऊपर भेजी गईं)' : 'Overdue: escalated to you'}</span>
            </SectionTitle>
          </div>
          {breached.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">{lang === 'hi' ? 'कोई समस्या समय सीमा पार नहीं।' : 'Nothing is overdue.'}</p>
          ) : (
            <ul className="divide-y divide-line">
              {breached.slice(0, 6).map((i) => (
                <IssueRow key={i.id} issue={i} to={`/issues/${i.id}`} />
              ))}
            </ul>
          )}
        </Card>
      </section>
    </Page>
  );
}
