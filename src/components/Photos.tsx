import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { photoUrl, uploadPhoto } from '../lib/api';
import { useLang } from '../lib/i18n';
import { cx } from './ui';

/** Private S3 image rendered through a short-lived pre-signed URL. */
export function S3Image({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    photoUrl(path)
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [path]);
  if (failed) return <div className={cx('grid place-items-center bg-surface-2 text-xs text-muted', className)}>Image unavailable</div>;
  if (!url) return <div className={cx('fl-skeleton', className)} />;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="block">
      <img src={url} alt={alt} loading="lazy" className={cx('object-cover bg-surface-2', className)} />
    </a>
  );
}

export function PhotoStrip({ paths, alt }: { paths: string[]; alt: string }) {
  if (!paths.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {paths.map((p) => (
        <S3Image key={p} path={p} alt={alt} className="size-24 rounded-xl border border-line" />
      ))}
    </div>
  );
}

/**
 * Pick or capture photos, compress on-device and upload to private S3 immediately,
 * so the final submit only sends small keys.
 */
export function PhotoPicker({
  kind,
  value,
  onChange,
  max = 3,
  label,
  onBusy,
}: {
  kind: 'report' | 'repair';
  value: string[];
  onChange: (keys: string[]) => void;
  max?: number;
  label: string;
  onBusy?: (busy: boolean) => void;
}) {
  const { lang } = useLang();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => onBusy?.(busy > 0), [busy, onBusy]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    const room = max - value.length;
    const picked = [...files].slice(0, room);
    let keys = [...value];
    for (const f of picked) {
      setBusy((b) => b + 1);
      try {
        const key = await uploadPhoto(f, kind);
        keys = [...keys, key];
        setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(f) }));
        onChange(keys);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((k) => (
          <div key={k} className="relative size-20 rounded-xl overflow-hidden border border-line">
            {previews[k] ? <img src={previews[k]} alt="" className="size-full object-cover" /> : <S3Image path={k} alt="" className="size-full" />}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== k))}
              className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/60 text-white"
              aria-label={lang === 'hi' ? 'फ़ोटो हटाएँ' : 'Remove photo'}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {busy > 0 && (
          <div className="grid place-items-center size-20 rounded-xl border border-dashed border-line-strong text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex flex-col items-center justify-center gap-1 size-20 rounded-xl border border-dashed border-line-strong text-ink-2 hover:border-brand hover:text-brand transition text-[11px] font-medium"
          >
            <ImagePlus className="size-5" />
            {label}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => add(e.target.files)} aria-label={label} />
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
