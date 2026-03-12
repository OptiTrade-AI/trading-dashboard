'use client';

import useSWR from 'swr';
import { useMarketStatus } from './useMarketStatus';
import type { SmartAlert } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useSmartAlerts() {
  const { isOpen } = useMarketStatus();

  const { data, error, isLoading } = useSWR<{ alerts: SmartAlert[]; available: boolean }>(
    '/api/ai/smart-alerts',
    fetcher,
    {
      refreshInterval: isOpen ? 5 * 60 * 1000 : 0, // 5 min during market hours only
      revalidateOnFocus: false,
    }
  );

  return {
    alerts: data?.alerts || [],
    available: data?.available ?? false,
    isLoading,
    error,
  };
}
