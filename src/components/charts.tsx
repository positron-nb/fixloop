/**
 * Small, dependency-free charts that follow the dataviz method:
 * one axis, thin marks, 4px rounded data ends, recessive grid, legend for ≥2 series,
 * values in text tokens, hover tooltips, and status colours only with icon + label.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { cx } from './ui';

export function KpiTile({ label, value, sub, icon, alert }: { label: string; value: string; sub?: ReactNode; icon?: ReactNode; alert?: boolean }) {
  return (
    <div className={cx('rounded-2xl border bg-surface p-4 shadow-card min-w-0', alert ? 'border-danger/40' : 'border-line')}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon && <span className={cx('shrink-0', alert && 'text-danger')}>{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-[26px] leading-none font-bold tracking-tight tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

/** Horizontal bar list: one series, one hue; value labels in ink. */
export function BarList({ rows, max, unit = '', color = 'var(--series-1)' }: { rows: { key: string; label: ReactNode; value: number; hint?: string }[]; max?: number; unit?: string; color?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={r.hint ?? `${r.value}${unit}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-ink-2">{r.label}</span>
            <span className="tabular-nums font-semibold text-ink">
              {r.value}
              {unit}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-r-[4px] transition-[width] duration-500 group-hover:opacity-80" style={{ width: `${(r.value / m) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Segmented status bar with a 2px surface gap between segments and a full legend underneath. */
export function SegmentBar({ segments }: { segments: { key: string; label: string; value: number; color: string; icon?: ReactNode }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] rounded-[4px] overflow-hidden bg-surface-2" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {total === 0 ? null : segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={cx('h-full transition-opacity', hover && hover !== s.key && 'opacity-40')}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <li key={s.key} className={cx('flex items-center gap-1.5 text-xs transition-opacity', hover && hover !== s.key && 'opacity-50')} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.icon}
            <span className="text-ink-2">{s.label}</span>
            <span className="font-semibold tabular-nums text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two-series daily trend (reported vs resolved) with crosshair + tooltip. */
export function TrendChart({ data, labels }: { data: { day: string; reported: number; resolved: number }[]; labels: { reported: string; resolved: string } }) {
  const W = 640;
  const H = 200;
  const P = { l: 28, r: 12, t: 12, b: 24 };
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(2, ...data.flatMap((d) => [d.reported, d.resolved]));
  const yMax = Math.ceil(max / 2) * 2;
  const x = (k: number) => P.l + (k * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / yMax) * (H - P.t - P.b);
  const path = (key: 'reported' | 'resolved') => data.map((d, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const ticks = [0, yMax / 2, yMax];
  const fmtDay = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div>
      <div className="flex items-center gap-4 text-xs mb-2" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--series-1)' }} /> <span className="text-ink-2">{labels.reported}</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--series-2)' }} /> <span className="text-ink-2">{labels.resolved}</span></span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${labels.reported} vs ${labels.resolved}, last ${data.length} days`} onMouseLeave={() => setHi(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
            </g>
          ))}
          {data.map((d, k) =>
            k % Math.ceil(data.length / 7) === 0 || k === data.length - 1 ? (
              <text key={d.day} x={x(k)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{fmtDay(d.day)}</text>
            ) : null,
          )}
          <path d={path('reported')} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path('resolved')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={P.t} y2={H - P.b} stroke="var(--axis)" strokeWidth={1} />}
          {hi !== null && (
            <>
              <circle cx={x(hi)} cy={y(data[hi].reported)} r={4.5} fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={2} />
              <circle cx={x(hi)} cy={y(data[hi].resolved)} r={4.5} fill="var(--series-2)" stroke="var(--chart-surface)" strokeWidth={2} />
            </>
          )}
          {data.map((d, k) => (
            <rect
              key={d.day}
              x={x(k) - (W - P.l - P.r) / data.length / 2}
              y={P.t}
              width={(W - P.l - P.r) / data.length}
              height={H - P.t - P.b}
              fill="transparent"
              onMouseEnter={() => setHi(k)}
              onTouchStart={() => setHi(k)}
            />
          ))}
        </svg>
        {hi !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop"
            style={{ left: `${(x(hi) / W) * 100}%`, transform: `translateX(${hi > data.length / 2 ? '-105%' : '5%'})` }}
          >
            <div className="font-semibold text-ink">{fmtDay(data[hi].day)}</div>
            <div className="text-ink-2"><span style={{ color: 'var(--series-1)' }}>●</span> {labels.reported}: <b className="text-ink">{data[hi].reported}</b></div>
            <div className="text-ink-2"><span style={{ color: 'var(--series-2)' }}>●</span> {labels.resolved}: <b className="text-ink">{data[hi].resolved}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Building × department heatmap on a single-hue sequential ramp; counts printed in cells. */
export function Heatmap({ rows, cols, cells, colLabel }: { rows: string[]; cols: string[]; cells: { row: string; col: string; value: number }[]; colLabel: (c: string) => string }) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  const lookup = useMemo(() => new Map(cells.map((c) => [`${c.row}|${c.col}`, c.value])), [cells]);
  const step = (v: number) => (v === 0 ? 0 : Math.min(6, 1 + Math.floor((v / max) * 5.999)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sr-only">Building</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="px-1 pb-1 text-[11px] font-medium text-muted text-center whitespace-nowrap">{colLabel(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left text-xs font-medium text-ink-2 whitespace-nowrap">{r}</th>
              {cols.map((c) => {
                const v = lookup.get(`${r}|${c}`) ?? 0;
                const s = step(v);
                return (
                  <td
                    key={c}
                    title={`${r} · ${colLabel(c)}: ${v}`}
                    className="h-9 min-w-10 rounded-[4px] text-center text-xs font-semibold tabular-nums transition hover:ring-2 hover:ring-ink/20"
                    style={{ background: `var(--seq-${s})`, color: s >= 4 ? '#fff' : 'var(--ink)' }}
                  >
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
