import { useEffect, useMemo, useState } from 'react';
import { listAssets, observeIssues } from './api';
import type { AssetRecord, IssueRecord } from '../../shared/types';

/**
 * Live campus data for admin pages: issues stream through AppSync subscriptions,
 * assets load once. Demo records can be included or excluded.
 */
export function useCampusData(includeDemo: boolean) {
  const [issues, setIssues] = useState<IssueRecord[] | null>(null);
  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => observeIssues((items) => setIssues(items), (e) => setError(e.message)), []);
  useEffect(() => {
    listAssets()
      .then(setAssets)
      .catch((e: Error) => setError(e.message));
  }, [tick]);

  const filtered = useMemo(() => {
    if (!issues || !assets) return null;
    return {
      issues: issues.filter((i) => includeDemo || !i.isDemo),
      assets: assets.filter((a) => includeDemo || !a.isDemo),
      hasDemo: issues.some((i) => i.isDemo) || assets.some((a) => a.isDemo),
      hasReal: issues.some((i) => !i.isDemo),
    };
  }, [issues, assets, includeDemo]);

  return { data: filtered, error, reloadAssets: () => setTick((t) => t + 1) };
}

/** Remembers the admin's "include demo data" preference per browser. */
export function useDemoToggle(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('fixloop.includeDemo') === '1';
    } catch {
      return false;
    }
  });
  return [
    v,
    (next: boolean) => {
      setV(next);
      try {
        localStorage.setItem('fixloop.includeDemo', next ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
  ];
}
