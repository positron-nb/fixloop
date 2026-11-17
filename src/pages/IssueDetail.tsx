import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  BadgeCheck,
  CircleDot,
  Flag,
  Hammer,
  MapPin,
  Play,
  RotateCcw,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  Timer,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { Page } from '../components/AppShell';
import { AssetTypeIcon, PriorityExplain, SlaChip } from '../components/IssueBits';
import { PhotoPicker, PhotoStrip } from '../components/Photos';
import { Button, Card, DemoBadge, EmptyState, ErrorBox, Field, PriorityBadge, SectionTitle, Sheet, Skeleton, StatusBadge, cx, inputClass } from '../components/ui';
import { eventsByIssue, getIssue, issueAction, myReports } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateTime, deptLabel, issueTypeLabel, relTime } from '../lib/format';
import { useLang } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { DEPARTMENTS, DEPARTMENT_CODES, getIssueType } from '../../shared/catalog';
import type { IssueEventRecord, IssueRecord } from '../../shared/types';
import { availableActions, type IssueAction } from '../../shared/workflow';

type SheetKind = null | 'resolve' | 'decline' | 'reassign' | 'invalid' | 'fixed' | 'notfixed';

export default function IssueDetail() {
  const { issueId = '' } = useParams();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const issue = useAsync(() => getIssue(issueId), [issueId]);
  const events = useAsync(() => eventsByIssue(issueId), [issueId]);
  const mine = useAsync(() => myReports(), [user?.sub]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState<IssueAction | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  if (issue.loading) {
    return (
      <Page narrow>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-32 mt-4" />
        <Skeleton className="h-40 mt-4" />
      </Page>
    );
  }
  if (issue.error) return <Page narrow><ErrorBox message={issue.error} onRetry={issue.reload} /></Page>;
  if (!issue.data) return <Page narrow><EmptyState icon="CircleDot" title={t('issue.notFound')} /></Page>;

  const i = issue.data;
  const linked = (mine.data ?? []).some((m) => m.issue.id === i.id);
  const myReport = (mine.data ?? []).find((m) => m.issue.id === i.id)?.report;
  const actions = user ? availableActions(i, user.actor, linked) : [];
  const issueType = getIssueType(i.assetType, i.issueType);

  const run = async (action: IssueAction, payload: { note?: string; evidenceKeys?: string[]; department?: string; rating?: number } = {}, msg = '') => {
    setBusy(action);
    setError('');
    try {
      const updated = await issueAction({ issueId: i.id, action, ...payload });
      issue.setData(updated);
      setSheet(null);
      setFlash(msg);
      void events.reload();
      void mine.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page narrow>
      <Link to={user?.isStaff && !linked ? '/staff' : user?.isAdmin ? '/admin/issues' : '/me'} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {t('common.back')}
      </Link>

      <Card className="mt-3 p-5">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-surface-2 text-ink-2">
            <AssetTypeIcon assetType={i.assetType} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted">#{i.id.slice(0, 8).toUpperCase()}</span>
              {i.isDemo && <DemoBadge />}
            </div>
            <h1 className="text-xl font-bold tracking-tight leading-snug">{issueTypeLabel(i.assetType, i.issueType, lang)}</h1>
            <Link to={`/a/${i.assetId}`} className="mt-0.5 text-sm text-ink-2 hover:text-brand flex items-start gap-1">
              <MapPin className="size-4 mt-0.5 shrink-0 text-muted" /> {i.assetName} · {i.building}
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={i.status} />
              <PriorityBadge band={i.priorityBand} score={i.priorityScore} />
              {i.severity === 'CRITICAL' && <span className="text-xs font-semibold text-danger">⚠ {lang === 'hi' ? 'सुरक्षा खतरा' : 'Safety hazard'}</span>}
              <SlaChip issue={i} />
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact icon={<Wrench className="size-4" />} label={t('issue.department')} value={deptLabel(i.department, lang)} />
          <Fact icon={<UserCheck className="size-4" />} label={t('issue.assignee')} value={i.assigneeName ?? t('issue.unassigned')} />
          <Fact icon={<CircleDot className="size-4" />} label={t('issue.reported')} value={dateTime(i.reportedAt, lang)} />
          <Fact icon={<AlarmClock className="size-4" />} label={t('issue.due')} value={dateTime(i.slaDueAt, lang)} warn={i.slaBreached && !i.resolvedAt} />
          <Fact icon={<Users className="size-4" />} label={t('issue.confirmations')} value={String(i.confirmationCount)} />
          <Fact icon={<RotateCcw className="size-4" />} label={t('issue.reopens')} value={String(i.reopenCount)} />
        </dl>

        {i.description && <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{i.description}</p>}
        {i.photoKeys.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted mb-2">{t('issue.reporterPhotos')}</p>
            <PhotoStrip paths={i.photoKeys} alt={issueTypeLabel(i.assetType, i.issueType, 'en')} />
          </div>
        )}
        {i.department === 'TRIAGE' && i.declineReason && (
          <p className="mt-4 rounded-xl bg-warn-soft text-warn p-3 text-sm">
            <b>{t('admin.triage')}:</b> {i.declineReason}
          </p>
        )}
        {i.invalidReason && <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2"><b>{lang === 'hi' ? 'अमान्य' : 'Invalid'}:</b> {i.invalidReason}</p>}
      </Card>

      {flash && (
        <div className="mt-4 fl-enter rounded-xl bg-ok-soft text-ok p-3 text-sm font-medium flex items-center gap-2" role="status">
          <BadgeCheck className="size-4" /> {flash}
        </div>
      )}
      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      {/* Reporter verification */}
      {actions.includes('VERIFY_FIXED') && (
        <Card className="mt-4 p-5 border-cyan/40 bg-cyan-soft/40">
          <h2 className="font-semibold text-lg">{t('verify.title')}</h2>
          <p className="text-sm text-ink-2 mt-1">{t('verify.body')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button variant="success" size="lg" icon={<ThumbsUp className="size-5" />} onClick={() => setSheet('fixed')}>
              {t('verify.yes')}
            </Button>
            <Button variant="danger" size="lg" icon={<ThumbsDown className="size-5" />} onClick={() => setSheet('notfixed')}>
              {t('verify.no')}
            </Button>
          </div>
        </Card>
      )}
      {myReport?.verification && (
        <p className="mt-4 text-sm text-ink-2 flex items-center gap-2">
          <BadgeCheck className="size-4 text-ok" />
          {lang === 'hi' ? 'आपने इसकी जाँच कर ली है।' : 'You have already checked this fix.'}
        </p>
      )}

      {/* Staff / admin actions */}
      {actions.some((a) => !['VERIFY_FIXED', 'VERIFY_NOT_FIXED'].includes(a)) && (
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap gap-2">
            {actions.includes('ACCEPT') && (
              <Button icon={<UserCheck className="size-4" />} loading={busy === 'ACCEPT'} onClick={() => run('ACCEPT', {}, lang === 'hi' ? 'कार्य स्वीकार किया' : 'Task accepted')}>
                {t('staff.accept')}
              </Button>
            )}
            {actions.includes('START') && (
              <Button icon={<Play className="size-4" />} loading={busy === 'START'} onClick={() => run('START', {}, lang === 'hi' ? 'काम शुरू' : 'Work started')}>
                {t('staff.start')}
              </Button>
            )}
            {actions.includes('RESOLVE') && (
              <Button variant="success" icon={<Hammer className="size-4" />} onClick={() => setSheet('resolve')}>
                {t('staff.resolve')}
              </Button>
            )}
            {actions.includes('DECLINE') && (
              <Button variant="secondary" icon={<Send className="size-4" />} onClick={() => setSheet('decline')}>
                {t('staff.decline')}
              </Button>
            )}
            {actions.includes('REASSIGN') && (
              <Button variant="secondary" icon={<Send className="size-4" />} onClick={() => setSheet('reassign')}>
                {t('admin.reassign')}
              </Button>
            )}
            {actions.includes('MARK_INVALID') && (
              <Button variant="ghost" icon={<Ban className="size-4" />} onClick={() => setSheet('invalid')}>
                {t('admin.markInvalid')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Resolution */}
      {(i.resolutionRemarks || i.repairEvidenceKeys.length > 0) && (
        <section className="mt-6">
          <SectionTitle>{t('issue.evidence')}</SectionTitle>
          <Card className="p-4">
            {i.resolutionRemarks && (
              <>
                <p className="text-xs font-semibold text-muted">{t('issue.remarks')}</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{i.resolutionRemarks}</p>
              </>
            )}
            {i.repairEvidenceKeys.length > 0 && <div className="mt-3"><PhotoStrip paths={i.repairEvidenceKeys} alt="Repair evidence" /></div>}
            {i.verificationOutcome === 'FIXED' && (
              <p className="mt-3 text-sm text-ok font-medium flex items-center gap-2">
                <BadgeCheck className="size-4" /> {lang === 'hi' ? 'छात्र ने पुष्टि की' : 'Verified by a reporter'}
                {i.verificationRating ? <span className="text-ink-2 font-normal">· {'★'.repeat(i.verificationRating)}</span> : null}
              </p>
            )}
          </Card>
        </section>
      )}

      <section className="mt-6">
        <Card className="p-4">
          <PriorityExplain issue={i} />
        </Card>
      </section>

      <section className="mt-6">
        <SectionTitle>{t('issue.timeline')}</SectionTitle>
        {events.loading ? <Skeleton className="h-32" /> : events.error ? <ErrorBox message={events.error} onRetry={events.reload} /> : <Timeline events={events.data ?? []} />}
      </section>

      <ActionSheets i={i} sheet={sheet} setSheet={setSheet} busy={busy} run={run} evidenceRequired={!!issueType?.evidenceRequired} />
    </Page>
  );
}

function Fact({ icon, label, value, warn }: { icon: ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className={cx('font-medium', warn && 'text-danger')}>{value}</dd>
      </div>
    </div>
  );
}

const EVENT_META: Record<string, { icon: ReactNode; en: string; hi: string; tone: string }> = {
  REPORTED: { icon: <Flag className="size-3.5" />, en: 'Reported', hi: 'रिपोर्ट हुई', tone: 'bg-info-soft text-info' },
  CONFIRMED: { icon: <Users className="size-3.5" />, en: 'Confirmed by another student', hi: 'दूसरे छात्र ने पुष्टि की', tone: 'bg-brand-soft text-brand' },
  ACCEPT: { icon: <UserCheck className="size-3.5" />, en: 'Accepted', hi: 'स्वीकार किया', tone: 'bg-violet-soft text-violet' },
  DECLINE: { icon: <Send className="size-3.5" />, en: 'Sent for re-routing', hi: 'दूसरे विभाग के लिए भेजा', tone: 'bg-warn-soft text-warn' },
  START: { icon: <Play className="size-3.5" />, en: 'Work started', hi: 'काम शुरू', tone: 'bg-warn-soft text-warn' },
  RESOLVE: { icon: <Hammer className="size-3.5" />, en: 'Marked repaired (with evidence)', hi: 'मरम्मत पूरी (सबूत के साथ)', tone: 'bg-cyan-soft text-cyan' },
  VERIFY_FIXED: { icon: <BadgeCheck className="size-3.5" />, en: 'Reporter verified the fix', hi: 'रिपोर्ट करने वाले ने पुष्टि की', tone: 'bg-ok-soft text-ok' },
  VERIFY_NOT_FIXED: { icon: <RotateCcw className="size-3.5" />, en: 'Reporter: still broken. Reopened', hi: 'अभी भी खराब: दोबारा खोली गई', tone: 'bg-rose-soft text-rose' },
  REASSIGN: { icon: <Send className="size-3.5" />, en: 'Reassigned by admin', hi: 'प्रशासक ने विभाग बदला', tone: 'bg-surface-2 text-ink-2' },
  MARK_INVALID: { icon: <Ban className="size-3.5" />, en: 'Marked invalid', hi: 'अमान्य घोषित', tone: 'bg-surface-2 text-ink-2' },
  AUTO_CLOSE: { icon: <Timer className="size-3.5" />, en: 'Closed without verification', hi: 'बिना पुष्टि बंद', tone: 'bg-surface-2 text-ink-2' },
  ESCALATED: { icon: <AlarmClock className="size-3.5" />, en: 'Escalated: service target missed', hi: 'समय सीमा पार: ऊपर भेजा गया', tone: 'bg-danger-soft text-danger' },
};

function Timeline({ events }: { events: (IssueEventRecord & { id: string })[] }) {
  const { lang } = useLang();
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Card className="p-4">
      <ol className="relative">
        {sorted.map((e, k) => {
          const m = EVENT_META[e.type] ?? EVENT_META.REPORTED;
          return (
            <li key={e.id} className="relative pl-10 pb-5 last:pb-0">
              {k < sorted.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line" aria-hidden />}
              <span className={cx('absolute left-0 top-0.5 grid place-items-center size-7 rounded-full', m.tone)}>{m.icon}</span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold">{lang === 'hi' ? m.hi : m.en}</span>
                <span className="text-xs text-muted">{relTime(e.at, lang)}</span>
              </div>
              <p className="text-xs text-muted">
                {e.actorRole === 'STUDENT' ? (lang === 'hi' ? 'छात्र' : 'Student') : e.actorRole === 'SYSTEM' ? 'FixLoop' : (e.actorName ?? e.actorRole)}
              </p>
              {e.note && <p className="mt-1 text-sm text-ink-2 whitespace-pre-wrap">{e.note}</p>}
              {e.evidenceKeys.length > 0 && <div className="mt-2"><PhotoStrip paths={e.evidenceKeys} alt={m.en} /></div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function ActionSheets({
  i,
  sheet,
  setSheet,
  busy,
  run,
  evidenceRequired,
}: {
  i: IssueRecord;
  sheet: SheetKind;
  setSheet: (s: SheetKind) => void;
  busy: IssueAction | null;
  run: (a: IssueAction, p?: { note?: string; evidenceKeys?: string[]; department?: string; rating?: number }, msg?: string) => Promise<void>;
  evidenceRequired: boolean;
}) {
  const { t, lang } = useLang();
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [dept, setDept] = useState('');
  const [uploading, setUploading] = useState(false);
  const close = () => {
    setSheet(null);
    setNote('');
    setPhotos([]);
    setRating(0);
    setDept('');
  };

  return (
    <>
      <Sheet
        open={sheet === 'resolve'}
        onClose={close}
        title={t('staff.resolve')}
        footer={
          <Button
            block
            size="lg"
            variant="success"
            loading={busy === 'RESOLVE'}
            disabled={note.trim().length < 10 || (evidenceRequired && photos.length === 0) || uploading}
            onClick={() => run('RESOLVE', { note: note.trim(), evidenceKeys: photos }, lang === 'hi' ? 'मरम्मत दर्ज। अब छात्र पुष्टि करेगा।' : 'Repair recorded. The reporter will now verify it.')}
          >
            {t('staff.resolve')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t('staff.remarks')} hint={t('staff.remarksHint')}>
            {(id) => <textarea id={id} rows={3} maxLength={1000} className={inputClass + ' resize-none'} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div>
            <p className="text-sm font-medium mb-1.5">
              {t('staff.evidence')} {!evidenceRequired && <span className="font-normal text-muted">({t('common.optional')})</span>}
            </p>
            <PhotoPicker kind="repair" value={photos} onChange={setPhotos} label={lang === 'hi' ? 'फ़ोटो' : 'Photo'} onBusy={setUploading} />
            {evidenceRequired && <p className="mt-1 text-xs text-muted">{t('staff.evidenceRequired')}</p>}
          </div>
          <p className="text-xs text-ink-2 rounded-lg bg-surface-2 p-2.5">{t('staff.resolveNote')}</p>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'decline'}
        onClose={close}
        title={t('staff.decline')}
        footer={
          <Button block loading={busy === 'DECLINE'} disabled={note.trim().length < 5} onClick={() => run('DECLINE', { note: note.trim() }, lang === 'hi' ? 'प्रशासक को भेजा गया' : 'Sent to admin for re-routing')}>
            {t('staff.decline')}
          </Button>
        }
      >
        <Field label={t('staff.declineReason')}>
          {(id) => <textarea id={id} rows={3} maxLength={500} className={inputClass + ' resize-none'} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Sheet>

      <Sheet
        open={sheet === 'reassign'}
        onClose={close}
        title={t('admin.reassign')}
        footer={
          <Button block loading={busy === 'REASSIGN'} disabled={!dept || dept === i.department} onClick={() => run('REASSIGN', { department: dept, note: note.trim() || undefined }, lang === 'hi' ? 'विभाग बदला गया' : 'Reassigned')}>
            {t('admin.reassign')}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-2" role="radiogroup">
          {DEPARTMENT_CODES.map((d) => (
            <label key={d} className={cx('flex items-center gap-3 rounded-xl border p-3 cursor-pointer', dept === d ? 'border-brand bg-brand-soft' : 'border-line')}>
              <input type="radio" name="dept" value={d} checked={dept === d} onChange={() => setDept(d)} className="accent-[var(--brand)]" disabled={d === i.department} />
              <span className="font-medium">{DEPARTMENTS[d].label[lang]}</span>
              {d === i.department && <span className="ml-auto text-xs text-muted">{lang === 'hi' ? 'वर्तमान' : 'current'}</span>}
            </label>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'invalid'}
        onClose={close}
        title={t('admin.markInvalid')}
        footer={
          <Button block variant="danger" loading={busy === 'MARK_INVALID'} disabled={note.trim().length < 5} onClick={() => run('MARK_INVALID', { note: note.trim() }, lang === 'hi' ? 'अमान्य घोषित' : 'Marked invalid')}>
            {t('admin.markInvalid')}
          </Button>
        }
      >
        <Field label={t('admin.invalidReason')}>
          {(id) => <textarea id={id} rows={3} maxLength={500} className={inputClass + ' resize-none'} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Sheet>

      <Sheet
        open={sheet === 'fixed'}
        onClose={close}
        title={t('verify.yes')}
        footer={
          <Button block size="lg" variant="success" loading={busy === 'VERIFY_FIXED'} onClick={() => run('VERIFY_FIXED', { rating: rating || undefined, note: note.trim() || undefined }, t('verify.thanks'))}>
            {t('verify.yes')}
          </Button>
        }
      >
        <p className="text-sm font-medium mb-2">{t('verify.rating')}</p>
        <div className="flex gap-1.5" role="radiogroup" aria-label={t('verify.rating')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className="p-1">
              <Star className={cx('size-8 transition', n <= rating ? 'fill-marigold text-marigold' : 'text-line-strong')} />
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Field label={t('verify.comment')} optional>
            {(id) => <textarea id={id} rows={2} maxLength={500} className={inputClass + ' resize-none'} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'notfixed'}
        onClose={close}
        title={t('verify.no')}
        footer={
          <Button block size="lg" variant="danger" loading={busy === 'VERIFY_NOT_FIXED'} disabled={uploading} onClick={() => run('VERIFY_NOT_FIXED', { note: note.trim() || undefined, evidenceKeys: photos }, t('verify.reopened'))}>
            {t('verify.no')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={lang === 'hi' ? 'क्या अभी भी खराब है?' : 'What is still wrong?'} optional>
            {(id) => <textarea id={id} rows={3} maxLength={500} className={inputClass + ' resize-none'} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <PhotoPicker kind="report" value={photos} onChange={setPhotos} label={lang === 'hi' ? 'फ़ोटो' : 'Photo'} onBusy={setUploading} />
        </div>
      </Sheet>
    </>
  );
}
