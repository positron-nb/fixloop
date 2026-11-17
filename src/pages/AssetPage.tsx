import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarClock, CheckCircle2, History, LogIn, MapPin, Plus, RotateCcw, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { Page } from '../components/AppShell';
import { AssetTypeIcon } from '../components/IssueBits';
import { PhotoPicker } from '../components/Photos';
import { Button, Card, DemoBadge, EmptyState, ErrorBox, Field, Pill, PriorityBadge, SectionTitle, Skeleton, StatusBadge, cx, inputClass } from '../components/ui';
import { confirmIssue, getAsset, issuesByAsset, myReports, reportIssue, type ReportResponse } from '../lib/api';
import { useAuth } from '../lib/auth';
import { assetTypeLabel, dateTime, deptLabel, issueTypeLabel, relTime } from '../lib/format';
import { useLang } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { getAssetType, type IssueType } from '../../shared/catalog';
import { activeSuggestions } from '../../shared/dedupe';
import { assetHistory } from '../../shared/assetIntel';
import { isActive, type AssetRecord, type IssueRecord } from '../../shared/types';
import { assetCodeFromScan } from '../../shared/validation';

type Mode = { kind: 'view' } | { kind: 'report' } | { kind: 'result'; res: ReportResponse };

export default function AssetPage() {
  const params = useParams();
  const code = assetCodeFromScan(params.assetId ?? '') ?? '';
  const { user, loading: authLoading } = useAuth();
  const { t } = useLang();
  const startedAt = useRef(performance.now());
  const [mode, setMode] = useState<Mode>({ kind: 'view' });

  const asset = useAsync(() => (authLoading || !code ? Promise.resolve(undefined) : getAsset(code, !!user)), [code, !!user, authLoading]);
  const issues = useAsync(() => (user && code ? issuesByAsset(code) : Promise.resolve([] as IssueRecord[])), [code, user?.sub]);
  const mine = useAsync(() => (user ? myReports() : Promise.resolve([])), [user?.sub]);
  const myIssueIds = useMemo(() => new Set((mine.data ?? []).map((m) => m.issue.id)), [mine.data]);

  const onDone = useCallback(
    (res: ReportResponse) => {
      setMode({ kind: 'result', res });
      void issues.reload();
      void mine.reload();
    },
    [issues, mine],
  );

  if (!code) {
    return (
      <Page narrow>
        <EmptyState icon="TriangleAlert" title={t('scan.invalid')} action={<Link to="/scan" className="text-brand font-semibold">{t('nav.scan')}</Link>} />
      </Page>
    );
  }

  if (asset.loading || authLoading) {
    return (
      <Page narrow>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full mt-4" />
        <Skeleton className="h-16 w-full mt-3" />
      </Page>
    );
  }
  if (asset.error) return <Page narrow><ErrorBox message={asset.error} onRetry={asset.reload} /></Page>;
  if (!asset.data) {
    return (
      <Page narrow>
        <EmptyState icon="CircleDot" title={`${t('asset.notFound')}: ${code}`} hint={t('asset.notFoundHint')} action={<Link to="/scan" className="text-brand font-semibold">{t('nav.scan')}</Link>} />
      </Page>
    );
  }

  const a = asset.data;
  const assetType = getAssetType(a.assetType);

  if (mode.kind === 'result') {
    return <ResultCard res={mode.res} onClose={() => setMode({ kind: 'view' })} />;
  }

  return (
    <Page narrow>
      <AssetHeader asset={a} />

      {a.status !== 'ACTIVE' && <div className="mt-4"><ErrorBox message={t('asset.retired')} /></div>}

      {!user ? (
        <Card className="mt-4 p-5 text-center">
          <p className="text-sm text-ink-2">{t('asset.signInToReport')}</p>
          <Link to={`/signin?next=${encodeURIComponent(`/a/${a.id}`)}`} className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand text-brand-ink font-semibold">
            <LogIn className="size-4" /> {t('nav.signIn')}
          </Link>
        </Card>
      ) : mode.kind === 'report' && assetType ? (
        <ReportFlow
          asset={a}
          issueTypes={assetType.issueTypes}
          active={activeSuggestions(issues.data ?? [])}
          myIssueIds={myIssueIds}
          startedAt={startedAt.current}
          onCancel={() => setMode({ kind: 'view' })}
          onDone={onDone}
        />
      ) : (
        <>
          {issues.error && <div className="mt-4"><ErrorBox message={issues.error} onRetry={issues.reload} /></div>}
          <ActiveIssues
            issues={issues.data ?? []}
            loading={issues.loading}
            myIssueIds={myIssueIds}
            startedAt={startedAt.current}
            onConfirmed={onDone}
          />
          {a.status === 'ACTIVE' && (
            <div className="sticky bottom-20 md:bottom-4 mt-5 z-10">
              <Button size="lg" block icon={<Plus className="size-5" />} onClick={() => setMode({ kind: 'report' })} className="shadow-pop">
                {(issues.data ?? []).some((i) => isActive(i.status)) ? t('asset.reportDifferent') : t('asset.reportNew')}
              </Button>
            </div>
          )}
          <AssetHistoryCard issues={issues.data ?? []} assetId={a.id} />
        </>
      )}
    </Page>
  );
}

function AssetHeader({ asset }: { asset: AssetRecord }) {
  const { lang } = useLang();
  const name = lang === 'hi' && asset.nameHi ? asset.nameHi : asset.name;
  const loc = lang === 'hi' && asset.locationLabelHi ? asset.locationLabelHi : asset.locationLabel;
  return (
    <Card className="p-5 overflow-hidden relative">
      <div className="absolute -right-6 -top-6 size-28 rounded-full bg-brand-soft" aria-hidden />
      <div className="relative flex items-start gap-4">
        <span className="grid place-items-center size-14 rounded-2xl bg-brand text-brand-ink shadow-sm">
          <AssetTypeIcon assetType={asset.assetType} className="size-7" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-muted">{asset.id}</span>
            {asset.isDemo && <DemoBadge />}
          </div>
          <h1 className="text-xl font-bold tracking-tight leading-snug">{name}</h1>
          <p className="mt-1 text-sm text-ink-2 flex items-start gap-1">
            <MapPin className="size-4 mt-0.5 shrink-0 text-muted" />
            <span>
              {asset.building}
              {asset.floor ? ` · ${lang === 'hi' ? 'मंज़िल' : 'Floor'} ${asset.floor}` : ''} · {loc}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">{assetTypeLabel(asset.assetType, lang)}</p>
        </div>
      </div>
    </Card>
  );
}

function ActiveIssues({
  issues,
  loading,
  myIssueIds,
  startedAt,
  onConfirmed,
}: {
  issues: IssueRecord[];
  loading: boolean;
  myIssueIds: Set<string>;
  startedAt: number;
  onConfirmed: (r: ReportResponse) => void;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = activeSuggestions(issues);

  if (loading) return <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;

  return (
    <section className="mt-6" aria-labelledby="active-h">
      <SectionTitle>
        <span id="active-h">{t('asset.activeIssues')}</span>
      </SectionTitle>
      {active.length === 0 ? (
        <Card className="p-4 flex items-center gap-3 text-sm text-ink-2">
          <CheckCircle2 className="size-5 text-ok" /> {t('asset.noActive')}
        </Card>
      ) : (
        <>
          <p className="text-sm text-ink-2 mb-3">{t('asset.isItOne')}</p>
          {error && <div className="mb-3"><ErrorBox message={error} /></div>}
          <ul className="space-y-2.5">
            {active.map((i) => {
              const mineHere = myIssueIds.has(i.id);
              return (
                <li key={i.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{issueTypeLabel(i.assetType, i.issueType, lang)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={i.status} />
                          <PriorityBadge band={i.priorityBand} />
                          <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                            <Users className="size-3.5" /> {i.confirmationCount + 1} {t('asset.reporters')}
                          </span>
                          <span className="text-xs text-muted">{relTime(i.reportedAt, lang)}</span>
                        </div>
                      </div>
                      <Link to={`/issues/${i.id}`} className="text-xs font-semibold text-brand shrink-0 mt-1">
                        {lang === 'hi' ? 'विवरण' : 'Details'}
                      </Link>
                    </div>
                    <div className="mt-3">
                      {mineHere && i.status === 'RESOLVED' ? (
                        <Link to={`/issues/${i.id}`} className="flex items-center justify-center gap-2 h-10 rounded-xl bg-cyan-soft text-cyan text-sm font-semibold">
                          <BadgeCheck className="size-4" /> {t('my.verifyNow')}
                        </Link>
                      ) : mineHere ? (
                        <Pill tone="brand" icon="UserCheck">{t('asset.confirmed')}</Pill>
                      ) : (
                        <Button
                          variant="secondary"
                          block
                          loading={busy === i.id}
                          icon={<Plus className="size-4" />}
                          onClick={async () => {
                            setBusy(i.id);
                            setError('');
                            try {
                              onConfirmed(await confirmIssue({ issueId: i.id, submitMs: Math.round(performance.now() - startedAt) }));
                            } catch (e) {
                              setError(e instanceof Error ? e.message : String(e));
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {i.status === 'RESOLVED' ? (lang === 'hi' ? 'अभी भी खराब है: बताएँ' : 'Still broken: tell them') : t('asset.confirm')}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function ReportFlow({
  asset,
  issueTypes,
  active,
  myIssueIds,
  startedAt,
  onCancel,
  onDone,
}: {
  asset: AssetRecord;
  issueTypes: IssueType[];
  active: IssueRecord[];
  myIssueIds: Set<string>;
  startedAt: number;
  onCancel: () => void;
  onDone: (r: ReportResponse) => void;
}) {
  const { t, lang, pick } = useLang();
  const [type, setType] = useState<IssueType | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [safety, setSafety] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const existing = type && !type.freeform ? active.find((i) => i.issueType === type.code) : undefined;
  const descTooShort = !!type?.freeform && description.trim().length < 5;

  const submit = async () => {
    if (!type) return;
    setSubmitting(true);
    setError('');
    try {
      const submitMs = Math.round(performance.now() - startedAt);
      const res = existing
        ? await confirmIssue({ issueId: existing.id, note: description.trim() || undefined, photoKeys: photos, submitMs })
        : await reportIssue({ assetId: asset.id, issueType: type.code, safetyHazard: safety, description: description.trim() || undefined, photoKeys: photos, submitMs });
      onDone(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-5 fl-enter" aria-labelledby="report-h">
      <button onClick={onCancel} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink mb-3">
        <ArrowLeft className="size-4" /> {t('common.back')}
      </button>
      <h2 id="report-h" className="text-lg font-semibold">{t('report.whatsWrong')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t('report.whatsWrong')}>
        {issueTypes.map((it) => {
          const dup = !it.freeform && active.find((i) => i.issueType === it.code);
          const selected = type?.code === it.code;
          return (
            <button
              key={it.code}
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setType(it);
                setError('');
                if (!it.safetyRelevant) setSafety(false);
              }}
              className={cx(
                'relative text-left rounded-2xl border p-3.5 min-h-[76px] transition',
                selected ? 'border-brand bg-brand-soft ring-2 ring-brand/30' : 'border-line bg-surface hover:border-line-strong',
                it.defaultSeverity === 'CRITICAL' && !selected && 'border-danger/30',
              )}
            >
              <span className="block font-semibold text-[15px] leading-tight">{pick(it.label)}</span>
              <span className="block text-xs text-muted mt-1">{lang === 'hi' ? it.label.en : it.label.hi}</span>
              {it.defaultSeverity === 'CRITICAL' && <AlertTriangle className="absolute top-3 right-3 size-4 text-danger" aria-label="Safety critical" />}
              {dup && <span className="absolute bottom-2 right-2 text-[10px] font-bold uppercase tracking-wide text-warn">{lang === 'hi' ? 'दर्ज है' : 'Reported'}</span>}
            </button>
          );
        })}
      </div>

      {type && (
        <div className="mt-5 space-y-4 fl-enter">
          {existing && (
            <div className="rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm">
              <p className="font-semibold text-warn flex items-center gap-2">
                <Sparkles className="size-4" /> {lang === 'hi' ? 'यह पहले से दर्ज है' : 'Already reported'}
              </p>
              <p className="mt-1 text-ink-2">
                {myIssueIds.has(existing.id)
                  ? t('report.alreadyBody')
                  : lang === 'hi'
                    ? `${existing.confirmationCount + 1} लोग इसे रिपोर्ट कर चुके हैं। भेजने पर आपकी पुष्टि जुड़ेगी, नई शिकायत नहीं बनेगी।`
                    : `${existing.confirmationCount + 1} people have reported this. Submitting adds your confirmation: no duplicate ticket.`}
              </p>
            </div>
          )}

          <Field label={t('report.description')} optional={!type.freeform} hint={t('report.descriptionHint')} error={type.freeform && description && descTooShort ? t('report.descriptionRequired') : undefined}>
            {(id) => (
              <textarea id={id} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass + ' resize-none'} placeholder={t('report.descriptionHint')} />
            )}
          </Field>

          <div>
            <p className="text-sm font-medium mb-1.5">
              {t('report.photo')} <span className="font-normal text-muted">({t('common.optional')})</span>
            </p>
            <PhotoPicker kind="report" value={photos} onChange={setPhotos} label={lang === 'hi' ? 'फ़ोटो' : 'Photo'} onBusy={setUploading} />
            <p className="mt-1 text-xs text-muted">{t('report.photoHint')}</p>
          </div>

          {type.safetyRelevant && type.defaultSeverity !== 'CRITICAL' && !existing && (
            <label className={cx('flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition', safety ? 'border-danger bg-danger-soft' : 'border-line bg-surface')}>
              <input type="checkbox" checked={safety} onChange={(e) => setSafety(e.target.checked)} className="mt-1 size-4 accent-[var(--danger)]" />
              <span className="text-sm">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-danger" /> {t('report.safety')}
                </span>
                <span className="text-muted text-xs">{lang === 'hi' ? 'सेवा लक्ष्य 4 घंटे हो जाएगा।' : 'Sets a 4-hour service target.'}</span>
              </span>
            </label>
          )}

          {error && <ErrorBox message={error} />}

          <div className="sticky bottom-20 md:bottom-4 z-10">
            <Button size="lg" block className="shadow-pop" disabled={descTooShort || uploading} loading={submitting} onClick={submit}>
              {submitting ? t('report.submitting') : existing ? t('asset.confirm') : t('report.submit')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ResultCard({ res, onClose }: { res: ReportResponse; onClose: () => void }) {
  const { t, lang } = useLang();
  const { outcome, issue } = res;
  const content = {
    CREATED: { icon: <CheckCircle2 className="size-9" />, tone: 'bg-ok-soft text-ok', title: t('report.created'), body: '' },
    CONFIRMED: { icon: <Users className="size-9" />, tone: 'bg-brand-soft text-brand', title: t('report.confirmedTitle'), body: t('report.confirmedBody') },
    ALREADY_REPORTED: { icon: <History className="size-9" />, tone: 'bg-info-soft text-info', title: t('report.alreadyTitle'), body: t('report.alreadyBody') },
    REOPENED: { icon: <RotateCcw className="size-9" />, tone: 'bg-rose-soft text-rose', title: t('report.reopenedTitle'), body: t('report.reopenedBody') },
  }[outcome];
  return (
    <Page narrow>
      <Card className="p-6 text-center">
        <div className={cx('fl-pop mx-auto grid place-items-center size-16 rounded-full', content.tone)}>{content.icon}</div>
        <h1 className="mt-4 text-xl font-bold">{content.title}</h1>
        {content.body && <p className="mt-2 text-sm text-ink-2">{content.body}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{t('report.routed')}</dt>
            <dd className="font-semibold text-sm mt-0.5">{deptLabel(issue.department, lang)}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{t('report.priority')}</dt>
            <dd className="mt-1"><PriorityBadge band={issue.priorityBand} score={issue.priorityScore} /></dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 col-span-2">
            <dt className="text-xs text-muted flex items-center gap-1"><CalendarClock className="size-3.5" /> {t('issue.sla')}</dt>
            <dd className="font-semibold text-sm mt-0.5">{dateTime(issue.slaDueAt, lang)}</dd>
          </div>
        </dl>
        <div className="mt-6 grid gap-2">
          <Link to={`/issues/${issue.id}`} className="inline-flex items-center justify-center h-12 rounded-xl bg-brand text-brand-ink font-semibold">
            {t('report.track')}
          </Link>
          <Button variant="ghost" onClick={onClose}>
            {t('report.another')}
          </Button>
        </div>
      </Card>
    </Page>
  );
}

function AssetHistoryCard({ issues, assetId }: { issues: IssueRecord[]; assetId: string }) {
  const { t, lang } = useLang();
  const h = useMemo(() => assetHistory(assetId, issues, new Date()), [issues, assetId]);
  const past = issues.filter((i) => !isActive(i.status)).slice(0, 5);
  if (!h.totalFaults) return null;
  const recText: Record<string, { en: string; hi: string }> = {
    REPEAT_FAILURE: { en: `Repeat failure: ${h.faultsInLast90Days} faults in 90 days. Preventive maintenance recommended.`, hi: `बार-बार खराबी: 90 दिनों में ${h.faultsInLast90Days} बार। निवारक रखरखाव की सलाह।` },
    RECURRING_SAME_FAULT: { en: 'The same fault keeps coming back: the previous fix may not be durable.', hi: 'एक ही खराबी लौट रही है: पिछली मरम्मत टिकाऊ नहीं लगती।' },
    FIX_NOT_HOLDING: { en: 'Repairs have failed reporter verification more than once.', hi: 'मरम्मत एक से ज़्यादा बार पुष्टि में विफल रही।' },
    SHORT_INTERVAL: { en: 'Faults recur within two weeks on average: consider replacement.', hi: 'औसतन दो हफ़्ते में खराबी लौटती है: बदलने पर विचार करें।' },
  };
  return (
    <section className="mt-8" aria-labelledby="hist-h">
      <SectionTitle>
        <span id="hist-h">{t('asset.history')}</span>
      </SectionTitle>
      <Card className="p-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t('asset.faults')} value={String(h.totalFaults)} />
          <Stat label={t('asset.verifiedRepairs')} value={String(h.verifiedRepairs)} />
          <Stat label={t('asset.lastService')} value={h.lastServiceAt ? relTime(h.lastServiceAt, lang) : t('asset.never')} />
          <Stat label={t('asset.mtbf')} value={h.mtbfDays === null ? '—' : String(h.mtbfDays)} />
        </dl>
        {h.recommendations.length > 0 && (
          <ul className="mt-4 space-y-2">
            {h.recommendations.map((r, k) => (
              <li key={k} className={cx('flex items-start gap-2 rounded-xl p-3 text-sm', r.severity === 'critical' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>{recText[r.code]?.[lang] ?? r.code}</span>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {past.map((i) => (
              <li key={i.id}>
                <Link to={`/issues/${i.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand">
                  <span>{issueTypeLabel(i.assetType, i.issueType, lang)}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={i.status} />
                    <span className="text-xs text-muted">{relTime(i.reportedAt, lang)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-[11px] text-muted leading-tight">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
