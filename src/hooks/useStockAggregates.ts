'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { AggBar } from '@/types';

export function useStockAggregates(tickers: string[]) {
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const from = yearAgo.toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const { data, error, isLoading } = useSWR<{ aggregates: Record<string, AggBar[]> }>(
    tickers.length > 0
      ? `/api/stock-aggregates?tickers=${tickers.join(',')}&timespan=day&multiplier=1&from=${from}&to=${to}`
      : null,
    { refreshInterval: 300000 }
  );

  const sparklines = useMemo(() => {
    const map = new Map<string, AggBar[]>();
    if (!data?.aggregates) return map;
    for (const [ticker, bars] of Object.entries(data.aggregates)) {
      map.set(ticker, bars.slice(-7));
    }
    return map;
  }, [data]);

  const yearRanges = useMemo(() => {
    const map = new Map<string, { low: number; high: number }>();
    if (!data?.aggregates) return map;
    for (const [ticker, bars] of Object.entries(data.aggregates)) {
      if (bars.length === 0) continue;
      let low = Infinity;
      let high = -Infinity;
      for (const bar of bars) {
        if (bar.l < low) low = bar.l;
        if (bar.h > high) high = bar.h;
      }
      map.set(ticker, { low, high });
    }
    return map;
  }, [data]);

  const allBars = useMemo(() => {
    const map = new Map<string, AggBar[]>();
    if (!data?.aggregates) return map;
    for (const [ticker, bars] of Object.entries(data.aggregates)) {
      map.set(ticker, bars);
    }
    return map;
  }, [data]);

  return { sparklines, yearRanges, allBars, isLoading, error: error?.message ?? null };
}
