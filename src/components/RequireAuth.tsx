import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useLang } from '../lib/i18n';
import { Page } from './AppShell';
import { EmptyState, Spinner } from './ui';

/** Route guard. UI-only convenience: the API enforces the same rules server-side. */
export function RequireAuth({ children, role }: { children: ReactNode; role?: 'staff' | 'admin' }) {
  const { user, loading } = useAuth();
  const { t, lang } = useLang();
  const loc = useLocation();
  if (loading) return <Spinner label={t('common.loading')} />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if ((role === 'admin' && !user.isAdmin) || (role === 'staff' && !user.isStaff)) {
    return (
      <Page narrow>
        <EmptyState
          icon="Ban"
          title={lang === 'hi' ? 'यह पेज आपकी भूमिका के लिए नहीं है' : 'This page is not available for your role'}
          hint={lang === 'hi' ? 'स्टाफ़ और प्रशासक खाते प्रशासक द्वारा बनाए जाते हैं।' : 'Staff and admin accounts are created by an administrator.'}
        />
      </Page>
    );
  }
  return <>{children}</>;
}
