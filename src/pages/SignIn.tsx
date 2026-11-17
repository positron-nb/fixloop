import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Page } from '../components/AppShell';
import { homeFor, useAuth } from '../lib/auth';
import { useLang } from '../lib/i18n';

/** Only same-site paths are allowed as redirect targets (prevents open redirects). */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/signin')) return null;
  return next;
}

function AfterSignIn() {
  const { user, refresh } = useAuth();
  useEffect(() => {
    if (!user) void refresh();
  }, [user, refresh]);
  return null;
}

export default function SignIn() {
  const { user, loading } = useAuth();
  const { lang } = useLang();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  if (!loading && user) return <Navigate to={next ?? homeFor(user)} replace />;

  return (
    <Page narrow>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{lang === 'hi' ? 'FixLoop में साइन इन करें' : 'Sign in to FixLoop'}</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          {lang === 'hi'
            ? 'छात्र ईमेल से खाता बना सकते हैं। आपकी पहचान स्टाफ़ या दूसरे छात्रों को नहीं दिखती।'
            : 'Students can create an account with their email. Your identity is never shown to staff or other students.'}
        </p>
      </div>
      <Authenticator loginMechanisms={['email']} signUpAttributes={[]}>
        {() => <AfterSignIn />}
      </Authenticator>
      <p className="mt-6 text-center text-xs text-muted">
        {lang === 'hi' ? 'स्टाफ़ और प्रशासक खाते प्रशासक आमंत्रण से बनते हैं।' : 'Staff and admin accounts are created by invitation from an administrator.'}
      </p>
    </Page>
  );
}
