import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Pencil, Plus, Printer, QrCode, Search, Trash2 } from 'lucide-react';
import { Page } from '../../components/AppShell';
import { AssetTypeIcon } from '../../components/IssueBits';
import { Button, Card, DemoBadge, EmptyState, ErrorBox, Field, Sheet, Skeleton, cx, inputClass } from '../../components/ui';
import { deleteAsset, saveAsset } from '../../lib/api';
import { assetTypeLabel } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import { useCampusData, useDemoToggle } from '../../lib/useCampusData';
import { assetHistory } from '../../../shared/assetIntel';
import { ASSET_TYPES } from '../../../shared/catalog';
import type { AssetRecord } from '../../../shared/types';
import { ASSET_CODE_RE, normaliseAssetCode } from '../../../shared/validation';
import { DemoToggle } from './AdminDashboard';

const blank: AssetRecord = { id: '', name: '', nameHi: '', assetType: 'WATER_COOLER', building: '', floor: '', locationLabel: '', locationLabelHi: '', criticality: 2, status: 'ACTIVE', installedOn: null, isDemo: false };

export default function AdminAssets() {
  const { t, lang } = useLang();
  const [includeDemo, setIncludeDemo] = useDemoToggle();
  const { data, error, reloadAssets } = useCampusData(includeDemo);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ asset: AssetRecord; isNew: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const now = useMemo(() => new Date(), [data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.assets ?? [])
      .filter((a) => !needle || [a.id, a.name, a.building, a.locationLabel].some((s) => s?.toLowerCase().includes(needle)))
      .map((a) => ({ a, h: assetHistory(a.id, data!.issues, now) }))
      .sort((x, y) => x.a.building.localeCompare(y.a.building) || x.a.id.localeCompare(y.a.id));
  }, [data, q, now]);

  if (error) return <Page><ErrorBox message={error} /></Page>;
  if (printing) return <QrSheet assets={(data?.assets ?? []).filter((a) => selected.has(a.id))} onClose={() => setPrinting(false)} />;

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.assets')}</h1>
          <p className="text-sm text-ink-2">{lang === 'hi' ? 'हर उपकरण की QR पहचान और रखरखाव इतिहास' : 'Every asset gets a QR identity and a maintenance memory.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoToggle value={includeDemo} onChange={setIncludeDemo} hasDemo={!!data?.hasDemo} />
          <Button variant="secondary" icon={<Printer className="size-4" />} disabled={!selected.size} onClick={() => setPrinting(true)}>
            {lang === 'hi' ? `QR लेबल (${selected.size})` : `QR labels (${selected.size})`}
          </Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ asset: { ...blank }, isNew: true })}>
            {lang === 'hi' ? 'उपकरण जोड़ें' : 'Add asset'}
          </Button>
        </div>
      </div>

      <div className="mt-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
        <label htmlFor="asset-q" className="sr-only">Search</label>
        <input id="asset-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'hi' ? 'कोड, नाम या भवन…' : 'Code, name or building…'} className={inputClass + ' pl-9 h-10 py-0'} />
      </div>

      <Card className="mt-4 overflow-hidden">
        {!data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="CircleDot" title={lang === 'hi' ? 'अभी कोई उपकरण नहीं' : 'No assets yet'} hint={lang === 'hi' ? 'पहला उपकरण जोड़ें और उसका QR प्रिंट करें।' : 'Add your first asset and print its QR label.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="size-4 accent-[var(--brand)]"
                      checked={selected.size > 0 && selected.size === rows.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.a.id)) : new Set())}
                    />
                  </th>
                  <th className="text-left font-medium px-2 py-2.5">{lang === 'hi' ? 'उपकरण' : 'Asset'}</th>
                  <th className="text-left font-medium px-2 py-2.5">{lang === 'hi' ? 'जगह' : 'Location'}</th>
                  <th className="text-right font-medium px-2 py-2.5">{lang === 'hi' ? 'खराबियाँ' : 'Faults'}</th>
                  <th className="text-right font-medium px-2 py-2.5">{lang === 'hi' ? 'खुली' : 'Active'}</th>
                  <th className="text-right font-medium px-2 py-2.5">{lang === 'hi' ? 'स्वास्थ्य' : 'Health'}</th>
                  <th className="px-2 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ a, h }) => (
                  <tr key={a.id} className={cx(selected.has(a.id) && 'bg-brand-soft/50')}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label={`Select ${a.id}`} className="size-4 accent-[var(--brand)]" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                    </td>
                    <td className="px-2 py-2.5">
                      <Link to={`/a/${a.id}`} className="flex items-center gap-2.5 hover:text-brand">
                        <span className="grid place-items-center size-8 rounded-lg bg-surface-2 text-ink-2"><AssetTypeIcon assetType={a.assetType} className="size-4" /></span>
                        <span className="min-w-0">
                          <span className="font-medium block truncate">{a.name}</span>
                          <span className="text-xs text-muted font-mono flex items-center gap-1.5">{a.id} {a.isDemo && <DemoBadge />} {a.status === 'RETIRED' && <span className="text-danger">retired</span>}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-ink-2">{a.building}{a.floor ? ` · ${a.floor}` : ''}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{h.totalFaults}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{h.activeFaults}</td>
                    <td className={cx('px-2 py-2.5 text-right tabular-nums font-semibold', h.healthScore < 50 ? 'text-danger' : h.healthScore < 80 ? 'text-warn' : 'text-ok')}>
                      {h.recommendations.length > 0 && <span className="mr-1" aria-label="recommendation">⚠</span>}
                      {h.healthScore}
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                      <button className="p-2 rounded-lg hover:bg-surface-2 text-ink-2" aria-label={`Edit ${a.id}`} onClick={() => setEditing({ asset: { ...a }, isNew: false })}>
                        <Pencil className="size-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-surface-2 text-ink-2" aria-label={`QR for ${a.id}`} onClick={() => { setSelected(new Set([a.id])); setPrinting(true); }}>
                        <QrCode className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <AssetEditor
          initial={editing.asset}
          isNew={editing.isNew}
          existingIds={new Set((data?.assets ?? []).map((a) => a.id))}
          hasIssues={!!data?.issues.some((i) => i.assetId === editing.asset.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reloadAssets();
          }}
        />
      )}
    </Page>
  );
}

function AssetEditor({ initial, isNew, existingIds, hasIssues, onClose, onSaved }: { initial: AssetRecord; isNew: boolean; existingIds: Set<string>; hasIssues: boolean; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useLang();
  const [a, setA] = useState<AssetRecord>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof AssetRecord>(k: K, v: AssetRecord[K]) => setA((x) => ({ ...x, [k]: v }));
  const code = normaliseAssetCode(a.id);
  const codeError = isNew && a.id && !ASSET_CODE_RE.test(code) ? (lang === 'hi' ? '3–24 अक्षर: A–Z, 0–9, -' : '3–24 characters: A–Z, 0–9 and -') : isNew && existingIds.has(code) ? (lang === 'hi' ? 'यह कोड पहले से है' : 'This code already exists') : '';
  const valid = ASSET_CODE_RE.test(code) && !codeError && a.name.trim().length >= 2 && a.building.trim() && a.locationLabel.trim();

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveAsset({ ...a, id: code, name: a.name.trim(), building: a.building.trim(), locationLabel: a.locationLabel.trim() }, isNew);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? (lang === 'hi' ? 'नया उपकरण' : 'New asset') : a.id}
      footer={
        <div className="flex gap-2">
          {!isNew && !hasIssues && (
            <Button
              variant="ghost"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!window.confirm(lang === 'hi' ? 'यह उपकरण हटाएँ?' : 'Delete this asset? This cannot be undone.')) return;
                setBusy(true);
                try {
                  await deleteAsset(a.id);
                  onSaved();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                  setBusy(false);
                }
              }}
            >
              {lang === 'hi' ? 'हटाएँ' : 'Delete'}
            </Button>
          )}
          <Button className="ml-auto" loading={busy} disabled={!valid} onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label={lang === 'hi' ? 'उपकरण कोड (QR पर छपेगा)' : 'Asset code (printed on the QR)'} error={codeError} hint="e.g. H4-WC-01">
          {(id) => <input id={id} className={inputClass + ' font-mono uppercase'} value={a.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} />}
        </Field>
        <Field label={lang === 'hi' ? 'प्रकार' : 'Type'}>
          {(id) => (
            <select id={id} className={inputClass} value={a.assetType} onChange={(e) => set('assetType', e.target.value)}>
              {ASSET_TYPES.map((x) => <option key={x.code} value={x.code}>{assetTypeLabel(x.code, lang)}</option>)}
            </select>
          )}
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={lang === 'hi' ? 'नाम (अंग्रेज़ी)' : 'Name (English)'}>{(id) => <input id={id} className={inputClass} value={a.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label={lang === 'hi' ? 'नाम (हिंदी)' : 'Name (Hindi)'} optional>{(id) => <input id={id} className={inputClass} value={a.nameHi ?? ''} onChange={(e) => set('nameHi', e.target.value)} />}</Field>
          <Field label={lang === 'hi' ? 'भवन' : 'Building'}>{(id) => <input id={id} className={inputClass} value={a.building} onChange={(e) => set('building', e.target.value)} />}</Field>
          <Field label={lang === 'hi' ? 'मंज़िल' : 'Floor'} optional>{(id) => <input id={id} className={inputClass} value={a.floor ?? ''} onChange={(e) => set('floor', e.target.value)} />}</Field>
        </div>
        <Field label={lang === 'hi' ? 'सटीक जगह' : 'Exact location'}>{(id) => <input id={id} className={inputClass} value={a.locationLabel} onChange={(e) => set('locationLabel', e.target.value)} placeholder="Near the main stairs" />}</Field>
        <Field label={lang === 'hi' ? 'सटीक जगह (हिंदी)' : 'Exact location (Hindi)'} optional>{(id) => <input id={id} className={inputClass} value={a.locationLabelHi ?? ''} onChange={(e) => set('locationLabelHi', e.target.value)} />}</Field>
        <Field label={lang === 'hi' ? 'महत्व' : 'Criticality'} hint={lang === 'hi' ? '3 = अकेला स्रोत या सुरक्षा से जुड़ा' : '3 = only source on the floor, or safety-related. Adds up to 12 priority points.'}>
          {(id) => (
            <select id={id} className={inputClass} value={a.criticality} onChange={(e) => set('criticality', Number(e.target.value))}>
              <option value={1}>1 · {lang === 'hi' ? 'सामान्य' : 'Normal'}</option>
              <option value={2}>2 · {lang === 'hi' ? 'महत्वपूर्ण' : 'Important'}</option>
              <option value={3}>3 · {lang === 'hi' ? 'अति महत्वपूर्ण' : 'Critical'}</option>
            </select>
          )}
        </Field>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={a.status === 'RETIRED'} onChange={(e) => set('status', e.target.checked ? 'RETIRED' : 'ACTIVE')} />
            {lang === 'hi' ? 'उपकरण हटाया गया (नई रिपोर्ट बंद)' : 'Retired (stops new reports, keeps history)'}
          </label>
        )}
        {error && <ErrorBox message={error} />}
      </div>
    </Sheet>
  );
}

/** Printable A4 sheet of bilingual QR labels. */
function QrSheet({ assets, onClose }: { assets: AssetRecord[]; onClose: () => void }) {
  const { lang } = useLang();
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    Promise.all(assets.map(async (a) => [a.id, await QRCode.toDataURL(`${window.location.origin}/a/${a.id}`, { margin: 1, width: 360, errorCorrectionLevel: 'M' })] as const)).then((pairs) => {
      if (live) setCodes(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  }, [assets]);

  return (
    <Page>
      <div className="no-print flex items-center justify-between gap-3 mb-5">
        <Button variant="ghost" onClick={onClose}>← {lang === 'hi' ? 'वापस' : 'Back'}</Button>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>{lang === 'hi' ? 'प्रिंट करें' : 'Print'}</Button>
      </div>
      <div className="qr-sheet grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((a) => (
          <div key={a.id} className="qr-label bg-white text-black rounded-2xl border border-line p-4 flex flex-col items-center text-center">
            <div className="text-[11px] font-bold tracking-widest text-[#0d6b5f]">FIXLOOP</div>
            <div className="text-sm font-bold mt-1">{lang === 'hi' ? 'कुछ खराब है? स्कैन करें' : 'Something broken? Scan me'}</div>
            <div className="text-xs">{lang === 'hi' ? 'Something broken? Scan me' : 'कुछ खराब है? स्कैन करें'}</div>
            {codes[a.id] ? <img src={codes[a.id]} alt={`QR code for ${a.id}`} className="w-40 h-40 my-2" /> : <div className="w-40 h-40 my-2 fl-skeleton" />}
            <div className="font-mono text-lg font-bold tracking-wider">{a.id}</div>
            <div className="text-xs mt-0.5">{a.name}</div>
            <div className="text-[10px] text-[#555]">{a.building} · {a.locationLabel}</div>
            {a.isDemo && <div className="mt-1 text-[9px] font-bold text-[#9a5b00]">DEMO</div>}
          </div>
        ))}
      </div>
    </Page>
  );
}
