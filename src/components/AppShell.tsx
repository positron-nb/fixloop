import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, Database, Gauge, Languages, ListChecks, LogIn, LogOut, Package, ScanLine, Users, WifiOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLang, type MsgKey } from '../lib/i18n';
import { Wordmark } from './Logo';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: MsgKey;
  icon: ReactNode;
  end?: boolean;
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t, toggle } = useLang();
  const online = useOnline();
  const navigate = useNavigate();
  const loc = useLocation();

  const nav: NavItem[] = [];
  if (user?.isAdmin) {
    nav.push(
      { to: '/admin', label: 'nav.dashboard', icon: <Gauge className="size-4" />, end: true },
      { to: '/admin/issues', label: 'nav.issues', icon: <ListChecks className="size-4" /> },
      { to: '/admin/assets', label: 'nav.assets', icon: <Package className="size-4" /> },
      { to: '/admin/people', label: 'nav.people', icon: <Users className="size-4" /> },
      { to: '/admin/data', label: 'nav.data', icon: <Database className="size-4" /> },
    );
  }
  if (user?.isStaff) nav.push({ to: '/staff', label: 'nav.tasks', icon: <ClipboardList className="size-4" /> });
  if (user) {
    nav.push({ to: '/scan', label: 'nav.scan', icon: <ScanLine className="size-4" /> });
    nav.push({ to: '/me', label: 'nav.myReports', icon: <ClipboardList className="size-4" /> });
  }

  // Phone bottom bar: the 3 most relevant destinations for this role.
  const bottom = user ? nav.filter((n) => ['/scan', '/me', '/staff', '/admin'].includes(n.to)).slice(0, 4) : [];

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-surface px-3 py-2 rounded-lg">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          <Link to="/" className="shrink-0" aria-label="FixLoop home">
            <Wordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 overflow-x-auto" aria-label="Main">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition', isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')
                }
              >
                {n.icon}
                {t(n.label)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={toggle} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-ink-2 hover:bg-surface-2" aria-label="Switch language / भाषा बदलें">
              <Languages className="size-4" />
              <span>{t('lang.toggle')}</span>
            </button>
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-ink-2 hover:bg-surface-2"
                title={user.email}
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">{t('nav.signOut')}</span>
              </button>
            ) : (
              <Link to={`/signin?next=${encodeURIComponent(loc.pathname)}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-brand hover:bg-brand-soft">
                <LogIn className="size-4" />
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </div>
        {!online && (
          <div className="bg-warn-soft text-warn text-sm px-4 py-2 flex items-center justify-center gap-2" role="status">
            <WifiOff className="size-4" /> {t('common.offline')}
          </div>
        )}
      </header>

      <main id="main" className={cx('flex-1 w-full', bottom.length > 0 && 'pb-20 md:pb-0')}>
        {children}
      </main>

      {bottom.length > 0 && (
        <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Quick">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${bottom.length}, 1fr)` }}>
            {bottom.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted')}
              >
                {n.icon}
                {t(n.label)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx('mx-auto w-full px-4 py-6 fl-enter', narrow ? 'max-w-xl' : 'max-w-6xl', className)}>{children}</div>;
}
