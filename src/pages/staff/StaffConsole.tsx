import { useEffect, useMemo, useState } from 'react';
import { Radio, UserCheck } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { IssueRow } from '../../components/IssueBits';
import { Button, Card, EmptyState, ErrorBox, Segmented, Skeleton } from '../../components/ui';
import { issueAction, observeIssues } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { deptLabel } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import type { IssueRecord } from '../../../shared/types';

type Tab = 'queue' | 'mine' | 'verify' | 'history';

export default function StaffConsole() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [issues, setIssues] = useState<IssueRecord[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('queue');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => observeIssues((items) => setIssues(items), (e) => setError(e.message)), []);

  const depts = user?.departments ?? [];
  const buckets = useMemo(() => {
    const list = issues ?? [];
    const inDept = list.filter((i) => depts.includes(i.department as never));
    const mine = list.filter((i) => i.assigneeSub === user?.sub);
    const byPriority = (a: IssueRecord, b: IssueRecord) => b.priorityScore - a.priorityScore || a.reportedAt.localeCompare(b.reportedAt);
    return {
      queue: inDept.filter((i) => i.status === 'OPEN' || i.status === 'REOPENED').sort(byPriority),
      mine: mine.filter((i) => i.status === 'ACKNOWLEDGED' || i.status === 'IN_PROGRESS').sort(byPriority),
      verify: mine.filter((i) => i.status === 'RESOLVED').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
      history: mine.filter((i) => ['CLOSED', 'CLOSED_UNVERIFIED', 'INVALID'].includes(i.status)).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')),
    };
  }, [issues, depts, user?.sub]);

  if (!user) return null;
  if (!depts.length) return <Page narrow><EmptyState icon="Wrench" title={t('staff.noDept')} /></Page>;

  const list = buckets[tab];

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('staff.title')}</h1>
          <p className="text-sm text-ink-2 mt-0.5">
            {depts.map((d) => deptLabel(d, lang)).join(' · ')}
            <span className="ml-2 inline-flex items-center gap-1 text-ok text-xs font-semibold">
              <Radio className="size-3.5" /> {t('admin.live')}
            </span>
          </p>
        </div>
        <Segmented<Tab>
          label={t('staff.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'queue', label: t('staff.queue'), count: buckets.queue.length },
            { value: 'mine', label: t('staff.mine'), count: buckets.mine.length },
            { value: 'verify', label: t('staff.done'), count: buckets.verify.length },
            { value: 'history', label: t('staff.history'), count: buckets.history.length },
          ]}
        />
      </div>

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      <Card className="mt-5">
        {issues === null ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-20" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState icon="CircleCheck" title={tab === 'queue' ? t('staff.emptyQueue') : t('staff.emptyMine')} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((i) => (
              <IssueRow
                key={i.id}
                issue={i}
                to={`/issues/${i.id}`}
                trailing={
                  tab === 'queue' ? (
                    <Button
                      size="sm"
                      icon={<UserCheck className="size-4" />}
                      loading={busy === i.id}
                      onClick={async (e) => {
                        e.preventDefault();
                        setBusy(i.id);
                        setError('');
                        try {
                          await issueAction({ issueId: i.id, action: 'ACCEPT' });
                          setTab('mine');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {t('staff.accept')}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
