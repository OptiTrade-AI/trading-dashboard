import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher } from '@/lib/fetcher';
import type { TickerScoreHistory } from '@/app/api/screeners/csp/history/route';

export function useCspScoreHistory(tickers: string[]) {
  // Cap at 50 tickers to avoid URL length issues
  const key = useMemo(() => {
    const unique = [...new Set(tickers)].sort().slice(0, 50).join(',');
    return unique ? `/api/screeners/csp/history?tickers=${unique}` : null;
  }, [tickers]);

  const { data, error, isLoading } = useSWR<Record<string, TickerScoreHistory>>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const historyMap = useMemo(() => {
    const map = new Map<string, TickerScoreHistory>();
    if (data) {
      for (const [ticker, history] of Object.entries(data)) {
        map.set(ticker, history);
      }
    }
    return map;
  }, [data]);

  return { historyMap, isLoading, error };
}
