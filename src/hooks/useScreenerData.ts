import useSWR from 'swr';
import type {
  AggressiveOpportunity,
  ScreenerTickerChanges,
  CspOpportunity,
  PipelineInfo,
} from '@/types';

export function useCspOpportunities() {
  return useSWR<CspOpportunity[]>('/api/screeners/csp', {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

interface AggressiveData {
  calls: AggressiveOpportunity[];
  puts: AggressiveOpportunity[];
  ticker_changes: {
    calls: ScreenerTickerChanges | null;
    puts: ScreenerTickerChanges | null;
  };
}

export function useAggressiveOpportunities() {
  return useSWR<AggressiveData>('/api/screeners/aggressive', {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function usePipelines() {
  return useSWR<PipelineInfo[]>('/api/pipelines', {
    refreshInterval: 10000,
  });
}

export function usePipelineHistory(type: string, limit = 10) {
  return useSWR<import('@/types').PipelineRunRecord[]>(
    `/api/pipelines/${type}/history?limit=${limit}`,
  );
}
