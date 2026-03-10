'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { TickerInfo } from '@/types';

export function useTickerDetails(tickers: string[]) {
  const key = tickers.length > 0
    ? `/api/ticker-details?tickers=${tickers.sort().join(',')}`
    : null;

  const { data, isLoading } = useSWR<{ tickers: TickerInfo[] }>(
    key,
    { dedupingInterval: 3600000 }
  );

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (data?.tickers) {
      for (const t of data.tickers) {
        map.set(t.ticker, t.name);
      }
    }
    return map;
  }, [data]);

  return { nameMap, isLoading };
}
