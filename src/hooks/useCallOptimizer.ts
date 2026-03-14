import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { OptimizerResult, OptimizerRow, OptimizerParams, OptimizerPreset, OptimizerAIAnalysis, AgentTraceStep } from '@/types';
import type { ProgressData } from '@/components/optimizer/OptimizerAIPanel';

const PRESETS: Record<Exclude<OptimizerPreset, 'custom'>, Omit<OptimizerParams, 'preset'>> = {
  conservative: { minDelta: 0.10, maxDelta: 0.20, minDTE: 21, maxDTE: 60, minPremium: 0.10, maxLossIfCalled: 0, targetReturnPct: 1 },
  moderate:     { minDelta: 0.15, maxDelta: 0.30, minDTE: 7,  maxDTE: 45, minPremium: 0.10, maxLossIfCalled: 0, targetReturnPct: 2 },
  aggressive:   { minDelta: 0.25, maxDelta: 0.40, minDTE: 0,  maxDTE: 21, minPremium: 0,    maxLossIfCalled: 0, targetReturnPct: 4 },
  recovery:     { minDelta: 0.10, maxDelta: 0.40, minDTE: 0,  maxDTE: 90, minPremium: 0,    maxLossIfCalled: 0, targetReturnPct: 2 },
};

const DEFAULT_PARAMS: OptimizerParams = {
  ...PRESETS.recovery,
  preset: 'recovery',
};

export function useCallOptimizer(ticker: string | null) {
  const [params, setParams] = useState<OptimizerParams>(DEFAULT_PARAMS);
  const [sortKey, setSortKey] = useState<keyof OptimizerRow>('annualizedReturn');
  const [sortAsc, setSortAsc] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<OptimizerAIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<string>('');
  const [aiProgressData, setAiProgressData] = useState<ProgressData | null>(null);
  const [aiTrace, setAiTrace] = useState<AgentTraceStep[]>([]);
  const [aiTraceMeta, setAiTraceMeta] = useState<{ traceId?: string; totalSteps?: number; durationMs?: number; costUsd?: number } | null>(null);

  // Fetch chain data — use wide DTE range from Polygon, filter client-side by params
  const { data, error, isLoading, mutate } = useSWR<OptimizerResult>(
    ticker ? `/api/cc-optimizer?ticker=${encodeURIComponent(ticker)}&minDTE=0&maxDTE=90` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // Apply preset
  const applyPreset = useCallback((preset: OptimizerPreset) => {
    if (preset === 'custom') {
      setParams(p => ({ ...p, preset: 'custom' }));
    } else {
      setParams({ ...PRESETS[preset], preset });
    }
  }, []);

  // Update individual param (switches to custom)
  const updateParam = useCallback(<K extends keyof OptimizerParams>(key: K, value: OptimizerParams[K]) => {
    setParams(p => ({ ...p, [key]: value, preset: 'custom' as OptimizerPreset }));
  }, []);

  // Filter chain by params
  const filteredChain = useMemo(() => {
    if (!data?.chain) return [];
    return data.chain.filter(row => {
      // Delta filter (handle null delta)
      if (row.delta !== null) {
        const absDelta = Math.abs(row.delta);
        if (absDelta < params.minDelta || absDelta > params.maxDelta) return false;
      }
      // DTE filter
      if (row.dte < params.minDTE || row.dte > params.maxDTE) return false;
      // Min premium filter
      if (row.premiumPerShare < params.minPremium) return false;
      // Max loss if called filter (0 = no limit)
      if (params.maxLossIfCalled > 0) {
        const lossPerShare = data.costBasisPerShare - row.strike - row.premiumPerShare;
        if (lossPerShare > params.maxLossIfCalled) return false;
      }
      return true;
    });
  }, [data, params]);

  // Sort chain
  const sortedChain = useMemo(() => {
    const sorted = [...filteredChain].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [filteredChain, sortKey, sortAsc]);

  // Toggle sort
  const toggleSort = useCallback((key: keyof OptimizerRow) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }, [sortKey]);

  // AI analysis for single ticker
  const runAIAnalysis = useCallback(async (targetTicker?: string) => {
    const t = targetTicker || ticker;
    if (!t) return;

    setAiLoading(true);
    setAiError(null);
    setAiProgress('Starting analysis...');
    setAiProgressData(null);
    setAiAnalysis(null);
    setAiTrace([]);
    setAiTraceMeta(null);

    try {
      const res = await fetch('/api/ai/cc-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: [t], mode: 'single', targetReturnPct: params.targetReturnPct }),
      });

      if (!res.ok) throw new Error('AI analysis failed');

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const event = JSON.parse(payload);
              if (event.type === 'progress') {
                setAiProgress(event.message);
                if (event.data) setAiProgressData(event.data);
              } else if (event.type === 'analysis') {
                setAiAnalysis(event.data);
              } else if (event.type === 'error') {
                setAiError(event.message);
              } else if (event.type === 'trace_step') {
                setAiTrace(prev => [...prev, event.data]);
              } else if (event.type === 'trace_complete') {
                setAiTraceMeta(event.data);
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setAiLoading(false);
      setAiProgress('');
      setAiProgressData(null);
    }
  }, [ticker, params.targetReturnPct]);

  return {
    // Data
    data,
    chain: sortedChain,
    unfilteredCount: data?.chain?.length || 0,
    isLoading,
    error: error?.message || null,

    // Params
    params,
    applyPreset,
    updateParam,

    // Sort
    sortKey,
    sortAsc,
    toggleSort,

    // AI
    aiAnalysis,
    aiLoading,
    aiError,
    aiProgress,
    aiProgressData,
    aiTrace,
    aiTraceMeta,
    runAIAnalysis,

    // Refresh
    refresh: mutate,
  };
}
