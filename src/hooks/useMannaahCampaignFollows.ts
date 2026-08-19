import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mannaah.followedCampaigns.v1';

type FollowRecord = { aTag: string; pubkey: string; identifier: string; title: string; followedAt: number };

function read(): FollowRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function write(items: FollowRecord[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
}

export function useMannaahCampaignFollows() {
  const [items, setItems] = useState<FollowRecord[]>(read);
  useEffect(() => {
    const onStorage = () => setItems(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const followed = useMemo(() => new Set(items.map((item) => item.aTag)), [items]);
  const toggleFollow = useCallback((record: Omit<FollowRecord, 'followedAt'>) => {
    setItems((current) => {
      const next = current.some((item) => item.aTag === record.aTag)
        ? current.filter((item) => item.aTag !== record.aTag)
        : [...current, { ...record, followedAt: Date.now() }];
      write(next);
      return next;
    });
  }, []);

  return { follows: items, followed, toggleFollow };
}
