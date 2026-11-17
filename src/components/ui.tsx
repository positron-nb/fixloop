import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, TriangleAlert, X } from 'lucide-react';
import { ICONS } from './icons';
import { BAND_META, STATUS_META, TONE_CLASS, type Tone } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { IssueStatus } from '../../shared/types';
import type { PriorityBand } from '../../shared/priority';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

export function Icon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? ICONS.Circle;
  return <I className={className} aria-hidden />;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  success: 'bg-ok text-white hover:opacity-90',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode; block?: boolean }
>(function Button({ variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, ...rest }, ref) {
  const sizes = { sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-5 text-base gap-2 rounded-xl' };
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-[background,opacity,transform] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
        sizes[size],
        VARIANT[variant],
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cx('bg-surface border border-line rounded-2xl shadow-card', className)}>{children}</As>;
}

export function Pill({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap', TONE_CLASS[tone], className)}>
      {icon && <Icon name={icon} className="size-3.5" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const { pick } = useLang();
  const m = STATUS_META[status];
  return (
    <Pill tone={m.tone} icon={m.icon}>
      {pick(m.label)}
    </Pill>
  );
}

export function PriorityBadge({ band, score }: { band: PriorityBand; score?: number }) {
  const m = BAND_META[band];
  return (
    <Pill tone={m.tone} className="tabular-nums" icon={band === 'P1' ? 'Flame' : undefined}>
      {m.label}
      {score !== undefined && <span className="opacity-70 font-medium">· {score}</span>}
    </Pill>
  );
}

export function DemoBadge() {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-warn/60 px-1.5 text-[10px] font-bold tracking-wider text-warn uppercase">
      {t('common.demo')}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('fl-skeleton', className)} aria-hidden />;
}

export function EmptyState({ icon = 'Inbox', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      <div className="grid place-items-center size-14 rounded-2xl bg-surface-2 text-muted mb-4">
        <Icon name={icon} className="size-7" />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted max-w-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <TriangleAlert className="size-4 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button className="font-semibold underline underline-offset-2" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Field({ label, hint, error, children, optional }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; optional?: boolean }) {
  const id = useId();
  const { t } = useLang();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({t('common.optional')})</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/80 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15';

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useLang();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={t('common.close')} onClick={onClose} />
      <div className="fl-enter relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-surface rounded-t-3xl sm:rounded-3xl shadow-pop">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid place-items-center size-9 rounded-full hover:bg-surface-2 text-muted" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1 gap-1 overflow-x-auto max-w-full">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'px-3 h-8 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-1.5',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cx('tabular-nums text-xs rounded-full px-1.5', value === o.value ? 'bg-brand-soft text-brand' : 'bg-surface-3 text-muted')}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  );
}
