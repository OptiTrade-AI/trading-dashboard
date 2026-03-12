'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDailySummary() {
  const { data, isLoading } = useSWR<{ summary: string | null; available: boolean }>(
    '/api/ai/daily-summary',
    fetcher,
    {
      refreshInterval: 60 * 60 * 1000, // 1 hour
      revalidateOnFocus: false,
    }
  );

  return {
    summary: data?.summary ?? null,
    available: data?.available ?? false,
    isLoading,
  };
}
