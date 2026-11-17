import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { IssueRow } from '../../components/IssueBits';
import { Card, EmptyState, ErrorBox, Segmented, Skeleton, inputClass } from '../../components/ui';
import { deptLabel } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import { useCampusData, useDemoToggle } from '../../lib/useCampusData';
import { DEPARTMENT_CODES, getIssueType } from '../../../shared/catalog';
import { isActive } from '../../../shared/types';
import { DemoToggle } from './AdminDashboard';

type Filter = 'active' | 'triage' | 'overdue' | 'verify' | 'closed' | 'all';

export default function AdminIssues() {
  const { t, lang } = useLang();
  const [includeDemo, setIncludeDemo] = useDemoToggle();
  const { data, error } = useCampusData(includeDemo);
  const [filter, setFilter] = useState<Filter>('active');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');

  const lists = useMemo(() => {
    const all = data?.issues ?? [];
    const now = Date.now();
    return {
      active: all.filter((i) => isActive(i.status)),
      triage: all.filter((i) => i.department === 'TRIAGE' && isActive(i.status)),
      overdue: all.filter((i) => ['OPEN', 'REOPENED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && now > new Date(i.slaDueAt).getTime()),
      verify: all.filter((i) => i.status === 'RESOLVED'),
      closed: all.filter((i) => !isActive(i.status)),
      all,
    };
  }, [data]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lists[filter]
      .filter((i) => !dept || i.department === dept)
      .filter((i) => {
        if (!needle) return true;
        const label = getIssueType(i.assetType, i.issueType)?.label;
        return [i.assetId, i.assetName, i.building, label?.en, label?.hi, i.id].some((s) => s?.toLowerCase().includes(needle));
      })
      .sort((a, b) => (isActive(a.status) && isActive(b.status) ? b.priorityScore - a.priorityScore : b.reportedAt.localeCompare(a.reportedAt)));
  }, [lists, filter, dept, q]);

  if (error) return <Page><ErrorBox message={error} /></Page>;

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.issues')}</h1>
        <DemoToggle value={includeDemo} onChange={setIncludeDemo} hasDemo={!!data?.hasDemo} />
      </div>
      <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <Segmented<Filter>
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: lang === 'hi' ? 'खुली' : 'Active', count: lists.active.length },
            { value: 'triage', label: t('admin.triage'), count: lists.triage.length },
            { value: 'overdue', label: lang === 'hi' ? 'समय सीमा पार' : 'Overdue', count: lists.overdue.length },
            { value: 'verify', label: lang === 'hi' ? 'पुष्टि बाकी' : 'Awaiting check', count: lists.verify.length },
            { value: 'closed', label: lang === 'hi' ? 'बंद' : 'Closed', count: lists.closed.length },
            { value: 'all', label: lang === 'hi' ? 'सभी' : 'All', count: lists.all.length },
          ]}
        />
        <div className="flex gap-2 lg:ml-auto">
          <label className="sr-only" htmlFor="dept-filter">{t('issue.department')}</label>
          <select id="dept-filter" value={dept} onChange={(e) => setDept(e.target.value)} className={inputClass + ' h-10 py-0 w-auto'}>
            <option value="">{lang === 'hi' ? 'सभी विभाग' : 'All departments'}</option>
            {[...DEPARTMENT_CODES, 'TRIAGE'].map((d) => (
              <option key={d} value={d}>{deptLabel(d, lang)}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <label className="sr-only" htmlFor="q">Search</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'hi' ? 'खोजें…' : 'Search…'} className={inputClass + ' h-10 py-0 pl-9 w-48'} />
          </div>
        </div>
      </div>
      <Card className="mt-4">
        {!data ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-20" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon="Inbox" title={lang === 'hi' ? 'कोई समस्या नहीं' : 'No issues match'} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.slice(0, 200).map((i) => (
              <IssueRow key={i.id} issue={i} to={`/issues/${i.id}`} />
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
