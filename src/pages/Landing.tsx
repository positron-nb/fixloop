import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Camera, ClipboardList, Gauge, QrCode, ShieldCheck, Wrench } from 'lucide-react';
import { Button, inputClass } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { useLang } from '../lib/i18n';
import { assetCodeFromScan } from '../../shared/validation';

export function Landing() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const open = (e: FormEvent) => {
    e.preventDefault();
    const c = assetCodeFromScan(code);
    if (!c) return setError(t('scan.invalid'));
    navigate(`/a/${c}`);
  };

  const steps = [
    { icon: <QrCode className="size-5" />, title: t('landing.how1'), body: t('landing.how1d') },
    { icon: <ClipboardList className="size-5" />, title: t('landing.how2'), body: t('landing.how2d') },
    { icon: <Wrench className="size-5" />, title: t('landing.how3'), body: t('landing.how3d') },
    { icon: <BadgeCheck className="size-5" />, title: t('landing.how4'), body: t('landing.how4d') },
  ];

  return (
    <div className="fl-enter">
      <section className="relative overflow-hidden bg-hero text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{ background: 'radial-gradient(900px 400px at 85% -10%, rgba(242,167,46,.35), transparent 60%), radial-gradient(700px 500px at -10% 110%, rgba(54,179,160,.45), transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-12 md:pt-16 md:pb-20 grid md:grid-cols-[1.1fr_.9fr] gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/85">
              <span className="size-1.5 rounded-full bg-marigold" /> {t('landing.kicker')}
            </p>
            <h1 className="mt-4 text-[28px] leading-[1.15] md:text-[44px] md:leading-[1.08] font-bold tracking-tight">{t('landing.title')}</h1>
            <p className="mt-4 text-[15px] md:text-lg text-white/80 max-w-xl">{t('landing.sub')}</p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 max-w-xl">
              <Button size="lg" className="bg-marigold! text-[#2a1a00]! hover:opacity-90" icon={<Camera className="size-5" />} onClick={() => navigate('/scan')}>
                {t('landing.scan')}
              </Button>
              <form onSubmit={open} className="flex-1 flex gap-2" noValidate>
                <label htmlFor="asset-code" className="sr-only">
                  {t('landing.enterCode')}
                </label>
                <input
                  id="asset-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  placeholder={t('landing.codePlaceholder')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={inputClass + ' h-12 bg-white/10! border-white/20! text-white! placeholder:text-white/50!'}
                />
                <Button size="lg" variant="secondary" type="submit" aria-label={t('landing.go')} className="bg-white/15! border-white/20! text-white! hover:bg-white/25!">
                  <ArrowRight className="size-5" />
                </Button>
              </form>
            </div>
            {error && <p className="mt-2 text-sm text-marigold" role="alert">{error}</p>}
            {user && (
              <p className="mt-5 text-sm text-white/75">
                <Link to={homeFor(user)} className="font-semibold text-white underline underline-offset-4">
                  {user.isAdmin ? t('nav.dashboard') : user.isStaff ? t('nav.tasks') : t('nav.myReports')} →
                </Link>
              </p>
            )}
          </div>

          {/* The loop, visualised */}
          <div className="hidden md:block" aria-hidden>
            <div className="relative mx-auto max-w-sm">
              {[
                { s: 'Reported', c: 'bg-white text-[#0f1a17]', d: 'Water cooler · Hostel 4 · No water', p: 'P2 · 58' },
                { s: '+3 confirmations', c: 'bg-white/90 text-[#0f1a17]', d: 'Merged instead of 3 duplicate tickets', p: 'P1 · 76' },
                { s: 'Repaired with photo', c: 'bg-white/80 text-[#0f1a17]', d: 'Plumbing · Float valve replaced', p: '4.2 h' },
                { s: 'Verified by student', c: 'bg-marigold text-[#2a1a00]', d: 'Closed only after "Yes, it works"', p: '★★★★★' },
              ].map((x, k) => (
                <div key={k} className={`fl-enter ${x.c} rounded-2xl px-4 py-3 shadow-pop mb-3`} style={{ animationDelay: `${120 + k * 110}ms`, marginLeft: `${k * 18}px` }}>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{x.s}</span>
                    <span className="tabular-nums opacity-70">{x.p}</span>
                  </div>
                  <div className="text-xs opacity-70 mt-0.5">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, k) => (
            <li key={k} className="bg-surface border border-line rounded-2xl p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center size-9 rounded-xl bg-brand-soft text-brand">{s.icon}</span>
                <span className="text-xs font-bold text-muted tabular-nums">0{k + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          <Link to="/me" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand/40 transition">
            <ClipboardList className="size-5 text-brand" />
            <span className="font-medium">{t('landing.myReports')}</span>
            <ArrowRight className="size-4 ml-auto text-muted group-hover:translate-x-0.5 transition" />
          </Link>
          <Link to="/staff" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand/40 transition">
            <Wrench className="size-5 text-brand" />
            <span className="font-medium">{t('landing.staff')}</span>
            <ArrowRight className="size-4 ml-auto text-muted group-hover:translate-x-0.5 transition" />
          </Link>
          <Link to="/admin" className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand/40 transition">
            <Gauge className="size-5 text-brand" />
            <span className="font-medium">{t('landing.admin')}</span>
            <ArrowRight className="size-4 ml-auto text-muted group-hover:translate-x-0.5 transition" />
          </Link>
        </div>

        <p className="mt-8 flex items-start gap-2 text-xs text-muted max-w-2xl">
          <ShieldCheck className="size-4 shrink-0" />
          {lang === 'hi'
            ? 'आपकी पहचान स्टाफ़ या अन्य छात्रों को कभी नहीं दिखाई जाती। फ़ोटो निजी स्टोरेज में रहती हैं और केवल साइन-इन उपयोगकर्ताओं को अस्थायी लिंक से दिखती हैं।'
            : 'Your identity is never shown to staff or other students. Photos are kept in private storage and shown to signed-in users through short-lived links.'}
        </p>
      </section>
    </div>
  );
}
