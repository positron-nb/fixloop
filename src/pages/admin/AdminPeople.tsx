import { useState } from 'react';
import { MailPlus, ShieldCheck } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { Button, Card, EmptyState, ErrorBox, Field, Pill, SectionTitle, Skeleton, inputClass } from '../../components/ui';
import { inviteStaff, listStaff } from '../../lib/api';
import { deptLabel } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import { useAsync } from '../../lib/useAsync';
import { DEPARTMENT_CODES, departmentForGroup } from '../../../shared/catalog';

export default function AdminPeople() {
  const { t, lang } = useLang();
  const staff = useAsync(listStaff, []);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [dept, setDept] = useState<string>('PLUMBING');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const invite = async () => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await inviteStaff({ email: email.trim(), name: name.trim(), department: dept || undefined, makeAdmin });
      setDone(
        res.created
          ? lang === 'hi' ? `${email} को आमंत्रण ईमेल भेजा गया।` : `Invitation email with a temporary password sent to ${email}.`
          : lang === 'hi' ? `${email} पहले से मौजूद है; समूह अपडेट किए गए।` : `${email} already had an account; roles updated.`,
      );
      setEmail('');
      setName('');
      void staff.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.people')}</h1>
      <div className="mt-5 grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        <Card>
          <div className="px-5 pt-5"><SectionTitle>{lang === 'hi' ? 'स्टाफ़ और प्रशासक' : 'Staff and administrators'}</SectionTitle></div>
          {staff.loading ? (
            <div className="p-5 space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-12" />)}</div>
          ) : staff.error ? (
            <div className="p-5"><ErrorBox message={staff.error} onRetry={staff.reload} /></div>
          ) : (staff.data ?? []).length === 0 ? (
            <EmptyState icon="UserCheck" title={lang === 'hi' ? 'अभी कोई स्टाफ़ नहीं' : 'No staff yet'} hint={lang === 'hi' ? 'दाईं ओर से आमंत्रित करें।' : 'Invite your maintenance team with the form.'} />
          ) : (
            <ul className="divide-y divide-line">
              {(staff.data ?? []).map((s) => (
                <li key={s.username} className="px-5 py-3 flex flex-wrap items-center gap-3">
                  <span className="grid place-items-center size-9 rounded-full bg-brand-soft text-brand font-semibold text-sm">{(s.name ?? s.email ?? '?').slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.name ?? s.email}</p>
                    <p className="text-xs text-muted truncate">{s.email} {s.status === 'FORCE_CHANGE_PASSWORD' && `· ${lang === 'hi' ? 'आमंत्रित' : 'invited'}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.groups.includes('ADMIN') && <Pill tone="violet" icon="BadgeCheck">{t('role.admin')}</Pill>}
                    {s.groups.map(departmentForGroup).filter(Boolean).map((d) => <Pill key={d} tone="brand">{deptLabel(d!, lang)}</Pill>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>{lang === 'hi' ? 'आमंत्रित करें' : 'Invite'}</SectionTitle>
          <div className="grid gap-4">
            <Field label={lang === 'hi' ? 'ईमेल' : 'Email'}>{(id) => <input id={id} type="email" autoComplete="off" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <Field label={lang === 'hi' ? 'नाम' : 'Name'} hint={lang === 'hi' ? 'समयरेखा में दिखेगा' : 'Shown on timelines, e.g. "Ramesh (Plumbing)"'}>{(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label={t('issue.department')}>
              {(id) => (
                <select id={id} className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)}>
                  {makeAdmin && <option value="">{lang === 'hi' ? 'कोई नहीं (केवल प्रशासक)' : 'None (admin only)'}</option>}
                  {DEPARTMENT_CODES.map((d) => <option key={d} value={d}>{deptLabel(d, lang)}</option>)}
                </select>
              )}
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
              <ShieldCheck className="size-4 text-violet" /> {lang === 'hi' ? 'प्रशासक अधिकार भी दें' : 'Also grant administrator access'}
            </label>
            {error && <ErrorBox message={error} />}
            {done && <p className="rounded-xl bg-ok-soft text-ok text-sm p-3" role="status">{done}</p>}
            <Button icon={<MailPlus className="size-4" />} loading={busy} disabled={!email.includes('@') || name.trim().length < 2 || (!makeAdmin && !dept)} onClick={invite}>
              {lang === 'hi' ? 'आमंत्रण भेजें' : 'Send invitation'}
            </Button>
            <p className="text-xs text-muted">
              {lang === 'hi' ? 'Cognito अस्थायी पासवर्ड ईमेल करता है। पहली बार साइन इन पर नया पासवर्ड बनाना होगा।' : 'Amazon Cognito emails a temporary password; they set their own on first sign-in.'}
            </p>
          </div>
        </Card>
      </div>
    </Page>
  );
}
