'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { useMarketStatus } from './useMarketStatus';
import { AggBar } from '@/types';

export function useOptionAggregates(
  optionSymbol: string | null,
  secondSymbol: string | null,
  from: string,
  to: string,
  timespan: 'minute' | 'day',
  multiplier: number
) {
  const { isOpen: marketOpen } = useMarketStatus();

  const tickers = useMemo(() => {
    if (!optionSymbol) return null;
    const syms = [optionSymbol];
    if (secondSymbol) syms.push(secondSymbol);
    return syms.join(',');
  }, [optionSymbol, secondSymbol]);

  const { data, error, isLoading } = useSWR<{ aggregates: Record<string, AggBar[]> }>(
    tickers
      ? `/api/stock-aggregates?tickers=${tickers}&timespan=${timespan}&multiplier=${multiplier}&from=${from}&to=${to}`
      : null,
    { refreshInterval: timespan === 'minute' && marketOpen ? 60000 : 0 }
  );

  const bars = useMemo(() => {
    if (!data?.aggregates || !optionSymbol) return [];
    return data.aggregates[optionSymbol] ?? [];
  }, [data, optionSymbol]);

  // For spreads: compute net bars (long - short)
  const netBars = useMemo(() => {
    if (!data?.aggregates || !optionSymbol || !secondSymbol) return null;
    const longBars = data.aggregates[optionSymbol] ?? [];
    const shortBars = data.aggregates[secondSymbol] ?? [];
    if (longBars.length === 0 && shortBars.length === 0) return null;

    // Build a time-indexed map of short bars
    const shortMap = new Map<number, AggBar>();
    for (const b of shortBars) shortMap.set(b.t, b);

    return longBars.map((lb) => {
      const sb = shortMap.get(lb.t);
      return {
        t: lb.t,
        o: lb.o - (sb?.o ?? 0),
        h: lb.h - (sb?.l ?? 0), // approximate net high
        l: lb.l - (sb?.h ?? 0), // approximate net low
        c: lb.c - (sb?.c ?? 0),
        v: lb.v,
      } as AggBar;
    });
  }, [data, optionSymbol, secondSymbol]);

  return { bars, netBars, isLoading, error: error?.message ?? null };
}
