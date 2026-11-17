import { Link } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { EmptyState } from '../components/ui';
import { useLang } from '../lib/i18n';

export function NotFound() {
  const { lang } = useLang();
  return (
    <Page narrow>
      <EmptyState
        icon="CircleDot"
        title={lang === 'hi' ? 'यह पेज नहीं मिला' : 'Page not found'}
        action={
          <Link to="/" className="text-brand font-semibold">
            {lang === 'hi' ? 'होम पर जाएँ' : 'Go home'}
          </Link>
        }
      />
    </Page>
  );
}
