import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher } from '@/lib/fetcher';

export function useEarningsDates(tickers: string[]) {
  // Dedupe and create stable key
  // Cap at 50 tickers to avoid URL length issues
  const key = useMemo(() => {
    const unique = [...new Set(tickers)].sort().slice(0, 50).join(',');
    return unique ? `/api/earnings-dates?tickers=${unique}` : null;
  }, [tickers]);

  const { data, error, isLoading } = useSWR<Record<string, string | null>>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 3600000, // 1 hour
    },
  );

  const earningsMap = useMemo(() => {
    const map = new Map<string, string | null>();
    if (data) {
      for (const [ticker, date] of Object.entries(data)) {
        map.set(ticker, date);
      }
    }
    return map;
  }, [data]);

  return { earningsMap, isLoading, error };
}
