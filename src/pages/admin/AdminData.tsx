import { useState } from 'react';
import { Database, Download, FlaskConical, Trash2 } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { Button, Card, ErrorBox, SectionTitle } from '../../components/ui';
import { demoData, listAllIssues } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import type { IssueRecord } from '../../../shared/types';

const CSV_FIELDS: (keyof IssueRecord)[] = [
  'id', 'isDemo', 'assetId', 'assetType', 'building', 'issueType', 'department', 'severity', 'status', 'priorityScore', 'priorityBand',
  'confirmationCount', 'reopenCount', 'escalationLevel', 'reportedAt', 'acknowledgedAt', 'startedAt', 'resolvedAt', 'closedAt', 'slaDueAt',
  'slaBreached', 'verificationOutcome', 'verificationRating', 'submitMs',
];

/** CSV export of issue metrics (no student identities): the raw data behind docs/PILOT_RESULTS.md. */
function toCsv(rows: IssueRecord[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_FIELDS.join(','), ...rows.map((r) => CSV_FIELDS.map((f) => esc(r[f])).join(','))].join('\n');
}

export default function AdminData() {
  const { lang } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setError('');
    setMsg('');
    try {
      setMsg(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = (includeDemo: boolean) =>
    run(includeDemo ? 'csv-all' : 'csv', async () => {
      const rows = (await listAllIssues()).filter((i) => includeDemo || !i.isDemo).sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
      const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fixloop-issues-${includeDemo ? 'with-demo' : 'pilot'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return lang === 'hi' ? `${rows.length} पंक्तियाँ डाउनलोड हुईं` : `Downloaded ${rows.length} rows`;
    });

  return (
    <Page narrow>
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Database className="size-6 text-brand" /> {lang === 'hi' ? 'डेटा' : 'Data'}</h1>
      {error && <div className="mt-4"><ErrorBox message={error} /></div>}
      {msg && <p className="mt-4 rounded-xl bg-ok-soft text-ok text-sm p-3" role="status">{msg}</p>}

      <Card className="mt-5 p-5">
        <SectionTitle>{lang === 'hi' ? 'पायलट डेटा निर्यात' : 'Export pilot data'}</SectionTitle>
        <p className="text-sm text-ink-2">
          {lang === 'hi'
            ? 'समस्याओं के समय और परिणाम CSV में। किसी छात्र की पहचान शामिल नहीं।'
            : 'Issue timings and outcomes as CSV, for pilot analysis. No student identities are included.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={<Download className="size-4" />} loading={busy === 'csv'} onClick={() => exportCsv(false)}>{lang === 'hi' ? 'केवल असली डेटा' : 'Real data only'}</Button>
          <Button variant="secondary" icon={<Download className="size-4" />} loading={busy === 'csv-all'} onClick={() => exportCsv(true)}>{lang === 'hi' ? 'डेमो सहित' : 'Including demo'}</Button>
        </div>
      </Card>

      <Card className="mt-4 p-5 border-dashed border-warn/50">
        <SectionTitle><span className="inline-flex items-center gap-1.5 text-warn"><FlaskConical className="size-4" /> {lang === 'hi' ? 'डेमो डेटा' : 'Demo data'}</span></SectionTitle>
        <p className="text-sm text-ink-2">
          {lang === 'hi'
            ? '12 डेमो उपकरण और ~19 डेमो समस्याएँ जोड़ता है, सभी पर DEMO लेबल। डैशबोर्ड इन्हें डिफ़ॉल्ट रूप से छिपाता है। इन्हें कभी पायलट परिणाम के रूप में प्रस्तुत न करें।'
            : 'Adds 12 demo assets and about 19 demo issues, all labelled DEMO (asset codes start with DEMO-). Dashboards hide them by default. Never present them as pilot results.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<FlaskConical className="size-4" />}
            loading={busy === 'load'}
            onClick={() => run('load', async () => {
              const r = await demoData('LOAD');
              return lang === 'hi' ? `${r.assets} डेमो उपकरण और ${r.issues} समस्याएँ जोड़ी गईं` : `Loaded ${r.assets} demo assets and ${r.issues} demo issues`;
            })}
          >
            {lang === 'hi' ? 'डेमो डेटा लोड करें' : 'Load demo data'}
          </Button>
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            loading={busy === 'clear'}
            onClick={() => {
              if (!window.confirm(lang === 'hi' ? 'सभी डेमो रिकॉर्ड हटाएँ? असली डेटा नहीं बदलेगा।' : 'Delete all DEMO records? Real data is not touched.')) return;
              void run('clear', async () => {
                const r = await demoData('CLEAR');
                return lang === 'hi' ? `${r.assets} डेमो उपकरण और ${r.issues} समस्याएँ हटाई गईं` : `Removed ${r.assets} demo assets and ${r.issues} demo issues`;
              });
            }}
          >
            {lang === 'hi' ? 'डेमो डेटा हटाएँ' : 'Clear demo data'}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
