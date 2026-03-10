'use client';

import useSWR from 'swr';
import { useMarketStatus } from './useMarketStatus';
import { AggBar } from '@/types';

export function useIntradayData(ticker: string | null) {
  const { isOpen: marketOpen } = useMarketStatus();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error, isLoading } = useSWR<{ aggregates: Record<string, AggBar[]> }>(
    ticker
      ? `/api/stock-aggregates?tickers=${ticker}&timespan=minute&multiplier=5&from=${today}&to=${today}`
      : null,
    { refreshInterval: marketOpen ? 60000 : 0 }
  );

  const bars = ticker && data?.aggregates?.[ticker] ? data.aggregates[ticker] : [];

  return { bars, isLoading, error: error?.message ?? null };
}
