import { Link } from 'react-router-dom';
import { BadgeCheck, ScanLine } from 'lucide-react';
import { Page } from '../components/AppShell';
import { IssueRow } from '../components/IssueBits';
import { Card, EmptyState, ErrorBox, SectionTitle, Skeleton } from '../components/ui';
import { myReports } from '../lib/api';
import { useLang } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';

export default function MyReports() {
  const { t } = useLang();
  const { data, error, loading, reload } = useAsync(myReports, []);

  if (loading) {
    return (
      <Page narrow>
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-24" />)}</div>
      </Page>
    );
  }
  if (error) return <Page narrow><ErrorBox message={error} onRetry={reload} /></Page>;

  const items = data ?? [];
  const toVerify = items.filter((m) => m.issue.status === 'RESOLVED' && !m.report.verification);
  const rest = items.filter((m) => !toVerify.includes(m));

  return (
    <Page narrow>
      <h1 className="text-2xl font-bold tracking-tight">{t('my.title')}</h1>
      {items.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon="Inbox"
            title={t('my.empty')}
            hint={t('my.emptyHint')}
            action={
              <Link to="/scan" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand text-brand-ink font-semibold">
                <ScanLine className="size-4" /> {t('landing.scan')}
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {toVerify.length > 0 && (
            <section className="mt-6">
              <SectionTitle>
                <span className="flex items-center gap-1.5 text-cyan">
                  <BadgeCheck className="size-4" /> {t('my.verifyNow')}
                </span>
              </SectionTitle>
              <Card className="border-cyan/40">
                <ul className="divide-y divide-line">
                  {toVerify.map((m) => (
                    <IssueRow key={m.issue.id} issue={m.issue} to={`/issues/${m.issue.id}`} />
                  ))}
                </ul>
              </Card>
            </section>
          )}
          <section className="mt-6">
            <Card>
              <ul className="divide-y divide-line">
                {rest.map((m) => (
                  <IssueRow key={m.issue.id} issue={m.issue} to={`/issues/${m.issue.id}`} />
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}
    </Page>
  );
}
