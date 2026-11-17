import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { Spinner } from './components/ui';
import { isConfigured } from './lib/amplify';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { Setup } from './pages/Setup';

const SignIn = lazy(() => import('./pages/SignIn'));
const Scan = lazy(() => import('./pages/Scan'));
const AssetPage = lazy(() => import('./pages/AssetPage'));
const MyReports = lazy(() => import('./pages/MyReports'));
const IssueDetail = lazy(() => import('./pages/IssueDetail'));
const StaffConsole = lazy(() => import('./pages/staff/StaffConsole'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminIssues = lazy(() => import('./pages/admin/AdminIssues'));
const AdminAssets = lazy(() => import('./pages/admin/AdminAssets'));
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople'));
const AdminData = lazy(() => import('./pages/admin/AdminData'));

export function App() {
  if (!isConfigured) return <Setup />;
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/a/:assetId" element={<AssetPage />} />
          <Route path="/me" element={<RequireAuth><MyReports /></RequireAuth>} />
          <Route path="/issues/:issueId" element={<RequireAuth><IssueDetail /></RequireAuth>} />
          <Route path="/staff" element={<RequireAuth role="staff"><StaffConsole /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/issues" element={<RequireAuth role="admin"><AdminIssues /></RequireAuth>} />
          <Route path="/admin/assets" element={<RequireAuth role="admin"><AdminAssets /></RequireAuth>} />
          <Route path="/admin/people" element={<RequireAuth role="admin"><AdminPeople /></RequireAuth>} />
          <Route path="/admin/data" element={<RequireAuth role="admin"><AdminData /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
