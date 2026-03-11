'use client';

import useSWR from 'swr';
import { MarketStatus } from '@/types';
import { isMarketOpen as isMarketOpenLocal } from '@/lib/utils';

export function useMarketStatus() {
  const { data, error, isLoading } = useSWR<{ status: MarketStatus; fetchedAt?: string }>(
    '/api/market-status',
    { refreshInterval: 60000 }
  );

  const status = data?.status ?? null;

  // Fallback to local time-based check if API unavailable
  const isOpen = status ? status.market === 'open' : isMarketOpenLocal();
  const isExtended = status?.market === 'extended-hours';

  const label: string = status
    ? status.market === 'open'
      ? 'Market Open'
      : status.market === 'extended-hours'
        ? 'Pre/After Hours'
        : 'Market Closed'
    : isMarketOpenLocal()
      ? 'Market Open'
      : 'Market Closed';

  return {
    status,
    isOpen,
    isExtended,
    label,
    serverTime: status?.serverTime ?? null,
    isLoading,
    error: error?.message ?? null,
  };
}
