import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraOff, Keyboard } from 'lucide-react';
import { Page } from '../components/AppShell';
import { Button, inputClass } from '../components/ui';
import { useLang } from '../lib/i18n';
import { assetCodeFromScan } from '../../shared/validation';

type CamState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';

export default function Scan() {
  const { t } = useLang();
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [cam, setCam] = useState<CamState>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const go = (raw: string) => {
    const c = assetCodeFromScan(raw);
    if (!c) {
      setError(t('scan.invalid'));
      return false;
    }
    scanner.current?.stop();
    navigate(`/a/${c}`);
    return true;
  };

  const start = async () => {
    setError('');
    setCam('starting');
    try {
      const { default: QrScanner } = await import('qr-scanner');
      if (!(await QrScanner.hasCamera())) return setCam('unavailable');
      const s = new QrScanner(video.current!, (res) => go(res.data), {
        preferredCamera: 'environment',
        highlightScanRegion: false,
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      });
      scanner.current = s;
      await s.start();
      setCam('running');
    } catch (e) {
      const name = (e as { name?: string })?.name ?? String(e);
      setCam(/NotAllowed|Permission|denied/i.test(name) ? 'denied' : 'unavailable');
    }
  };

  useEffect(() => {
    void start();
    return () => scanner.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(code);
  };

  return (
    <Page narrow>
      <h1 className="text-xl font-bold tracking-tight">{t('scan.title')}</h1>
      <p className="text-sm text-ink-2 mt-1">{t('scan.hint')}</p>

      <div className="mt-5 relative aspect-square w-full overflow-hidden rounded-3xl bg-[#0b1513] shadow-pop">
        <video ref={video} className="absolute inset-0 size-full object-cover" muted playsInline aria-label="Camera preview" />
        {cam === 'running' && (
          <div className="absolute inset-[14%] rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" aria-hidden>
            <div className="absolute left-3 right-3 top-3 h-0.5 bg-marigold/90 rounded-full" style={{ animation: 'fl-scanline 2.4s ease-in-out infinite' }} />
          </div>
        )}
        {cam !== 'running' && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-white/85">
            <div>
              {cam === 'denied' || cam === 'unavailable' ? <CameraOff className="size-10 mx-auto mb-3 opacity-80" /> : <Camera className="size-10 mx-auto mb-3 opacity-80" />}
              <p className="text-sm">{cam === 'denied' ? t('scan.permission') : cam === 'unavailable' ? t('scan.noCamera') : t('common.loading')}</p>
              {(cam === 'denied' || cam === 'idle') && (
                <Button className="mt-4" variant="secondary" onClick={start}>
                  {t('scan.start')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-6" noValidate>
        <label htmlFor="code" className="flex items-center gap-2 text-sm font-medium mb-1.5">
          <Keyboard className="size-4 text-muted" /> {t('landing.enterCode')}
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            className={inputClass + ' uppercase tracking-wide'}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            placeholder={t('landing.codePlaceholder')}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
          />
          <Button type="submit">{t('landing.go')}</Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Page>
  );
}
