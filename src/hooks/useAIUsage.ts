'use client';

import useSWR from 'swr';
import type { AIUsageStats } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAIUsage() {
  const { data, error, isLoading } = useSWR<AIUsageStats>('/api/ai/usage', fetcher, {
    refreshInterval: 60000, // 1 min
    revalidateOnFocus: false,
  });

  return {
    stats: data || null,
    isLoading,
    error,
  };
}
