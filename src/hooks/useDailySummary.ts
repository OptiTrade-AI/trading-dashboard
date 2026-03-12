'use client';

import useSWR from 'swr';
import { useCallback, useState } from 'react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDailySummary() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, mutate } = useSWR<{ summary: string | null; available: boolean }>(
    '/api/ai/daily-summary',
    fetcher,
    {
      refreshInterval: 60 * 60 * 1000, // 1 hour
      revalidateOnFocus: false,
    }
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/ai/daily-summary?refresh=1');
      const fresh = await res.json();
      mutate(fresh, false);
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return {
    summary: data?.summary ?? null,
    available: data?.available ?? false,
    isLoading,
    refreshing,
    refresh,
  };
}
