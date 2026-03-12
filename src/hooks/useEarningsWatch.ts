'use client';

import useSWR from 'swr';
import type { EarningsEvent } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useEarningsWatch() {
  const { data, error, isLoading } = useSWR<{ events: EarningsEvent[]; available: boolean }>(
    '/api/ai/events-check',
    fetcher,
    {
      refreshInterval: 4 * 60 * 60 * 1000, // 4 hours
      revalidateOnFocus: false,
    }
  );

  return {
    events: data?.events || [],
    available: data?.available ?? false,
    isLoading,
    error,
  };
}
