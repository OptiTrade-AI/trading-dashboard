'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useMarketStatus } from './useMarketStatus';
import { StockPrice } from '@/types';

export function useStockPrices(tickers: string[]) {
  const { isOpen: marketOpen } = useMarketStatus();
  const refreshInterval = tickers.length > 0 ? (marketOpen ? 60000 : 300000) : 0;

  const { data, error, isLoading } = useSWR<{ prices: StockPrice[] }>(
    tickers.length > 0 ? `/api/stock-prices?tickers=${tickers.join(',')}` : null,
    { refreshInterval }
  );

  const prices = useMemo(() => {
    const map = new Map<string, StockPrice>();
    (data?.prices ?? []).forEach((p) => map.set(p.ticker, p));
    return map;
  }, [data]);

  return { prices, isLoading, error: error?.message ?? null };
}
