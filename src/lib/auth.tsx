import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchAuthSession, fetchUserAttributes, signOut as amplifySignOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { isConfigured } from './amplify';
import { departmentForGroup, type DepartmentCode } from '../../shared/catalog';
import type { Actor } from '../../shared/types';

export interface SessionUser {
  sub: string;
  username: string;
  email?: string;
  name?: string;
  groups: string[];
  isAdmin: boolean;
  isStaff: boolean;
  departments: DepartmentCode[];
  actor: Actor;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function loadUser(): Promise<SessionUser | null> {
  if (!isConfigured) return null;
  try {
    const session = await fetchAuthSession();
    const access = session.tokens?.accessToken;
    if (!access) return null;
    const groups = ((access.payload['cognito:groups'] as string[] | undefined) ?? []).slice();
    const sub = String(access.payload.sub);
    const username = String(access.payload.username ?? sub);
    const attrs = await fetchUserAttributes().catch(() => ({}) as Record<string, string | undefined>);
    const departments = groups.map(departmentForGroup).filter((d): d is DepartmentCode => !!d);
    const isAdmin = groups.includes('ADMIN');
    const isStaff = groups.includes('STAFF');
    return {
      sub,
      username,
      email: attrs.email,
      name: attrs.name,
      groups,
      isAdmin,
      isStaff,
      departments,
      actor: { sub, username, groups, displayName: attrs.name },
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await loadUser());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (!isConfigured) return;
    const stop = Hub.listen('auth', ({ payload }) => {
      if (['signedIn', 'signedOut', 'tokenRefresh', 'signInWithRedirect'].includes(payload.event)) void refresh();
    });
    return stop;
  }, [refresh]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, signOut }), [user, loading, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Where a user should land after sign-in. */
export function homeFor(user: SessionUser | null): string {
  if (!user) return '/';
  if (user.isAdmin) return '/admin';
  if (user.isStaff) return '/staff';
  return '/me';
}
