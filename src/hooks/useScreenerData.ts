import useSWR from 'swr';
import type {
  CspOpportunity,
  PcsOpportunity,
  AggressiveOpportunity,
  ScreenerTickerChanges,
  ChartSetup,
  SwingSignal,
  PipelineInfo,
} from '@/types';

export function useCspOpportunities() {
  return useSWR<CspOpportunity[]>('/api/screeners/csp', {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function usePcsOpportunities() {
  return useSWR<PcsOpportunity[]>('/api/screeners/pcs', {
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

interface ChartSetupData {
  timestamp: string | null;
  total_setups_found: number;
  chart_setups: ChartSetup[];
}

export function useChartSetups() {
  return useSWR<ChartSetupData>('/api/screeners/charts', {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

interface SwingData {
  long_signals: SwingSignal[];
  short_signals: SwingSignal[];
  timestamp: string | null;
}

export function useSwingSignals() {
  return useSWR<SwingData>('/api/screeners/swing', {
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
