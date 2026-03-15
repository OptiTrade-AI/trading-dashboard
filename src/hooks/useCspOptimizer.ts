import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useCspOpportunities } from './useScreenerData';
import type { CspOpportunity, CspOptimizerAIAnalysis, AgentTraceStep } from '@/types';

export interface CspOptimizerProgressData {
  ticker?: string;
  iteration?: number;
  elapsedMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

export type CspFilterPreset = 'conservative' | 'balanced' | 'aggressive' | 'all';

const MARKET_CAP_VALUES: Record<string, number> = {
  any: 0, '500M': 500_000_000, '1B': 1_000_000_000, '4B': 4_000_000_000,
  '10B': 10_000_000_000, '50B': 50_000_000_000,
};

export interface CspOptimizerFilters {
  minDelta: number;
  maxDelta: number;
  minDte: number;
  maxDte: number;
  minRor: number;
  minIv: number;
  minOi: number;
  minMarketCap: string;
  minScore: number;
  sector: string;
  tickerSearch: string;
}

export const defaultCspOptimizerFilters: CspOptimizerFilters = {
  minDelta: 0,
  maxDelta: 1,
  minDte: 0,
  maxDte: 90,
  minRor: 0,
  minIv: 0,
  minOi: 0,
  minMarketCap: 'any',
  minScore: 0,
  sector: 'all',
  tickerSearch: '',
};

const FILTER_PRESETS: Record<Exclude<CspFilterPreset, 'all'>, Partial<CspOptimizerFilters>> = {
  conservative: { minDelta: 0.10, maxDelta: 0.22, minDte: 28, maxDte: 60, minScore: 65, minMarketCap: '10B' },
  balanced:     { minDelta: 0.18, maxDelta: 0.32, minDte: 14, maxDte: 45, minScore: 40, minMarketCap: '1B' },
  aggressive:   { minDelta: 0.25, maxDelta: 0.45, minDte: 7,  maxDte: 28, minScore: 20, minMarketCap: '500M' },
};

function applyClientFilters(data: CspOpportunity[], filters: CspOptimizerFilters): CspOpportunity[] {
  return data.filter(opp => {
    const absDelta = Math.abs(opp.delta);
    if (absDelta < filters.minDelta || absDelta > filters.maxDelta) return false;
    if (opp.dte < filters.minDte || opp.dte > filters.maxDte) return false;
    if (opp.return_on_risk_pct < filters.minRor) return false;
    if (opp.implied_volatility * 100 < filters.minIv) return false;
    if (opp.open_interest < filters.minOi) return false;
    const minCap = MARKET_CAP_VALUES[filters.minMarketCap] || 0;
    if (opp.market_cap < minCap) return false;
    if ((opp.score ?? 0) < filters.minScore) return false;
    if (filters.sector !== 'all' && opp.sector !== filters.sector) return false;
    if (filters.tickerSearch && !opp.ticker.toLowerCase().includes(filters.tickerSearch.toLowerCase())) return false;
    return true;
  });
}

export function useCspOptimizer() {
  // Screener data from pipeline
  const { data: screenerData, error: screenerError, isLoading: screenerLoading, mutate } = useCspOpportunities();

  // Filters
  const [filters, setFilters] = useState<CspOptimizerFilters>({ ...defaultCspOptimizerFilters });
  const [activePreset, setActivePreset] = useState<CspFilterPreset | null>(null);

  // Selection
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());

  // AI state
  const [analyses, setAnalyses] = useState<Map<string, CspOptimizerAIAnalysis>>(new Map());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<string>('');
  const [aiProgressData, setAiProgressData] = useState<CspOptimizerProgressData | null>(null);
  const [aiTrace, setAiTrace] = useState<AgentTraceStep[]>([]);
  const [aiTraceMeta, setAiTraceMeta] = useState<{ traceId?: string; totalSteps?: number; durationMs?: number; costUsd?: number } | null>(null);
  const [analyzingTickers, setAnalyzingTickers] = useState<Set<string>>(new Set());
  const [analyzedTickers, setAnalyzedTickers] = useState<Set<string>>(new Set());

  // Abort controller for SSE stream
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Sort
  const [sortKey, setSortKey] = useState<keyof CspOpportunity>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Filtered data
  const filteredData = useMemo(() => {
    if (!screenerData) return [];
    return applyClientFilters(screenerData, filters);
  }, [screenerData, filters]);

  // Sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredData, sortKey, sortAsc]);

  // Sectors
  const sectors = useMemo(() => {
    if (!screenerData) return [];
    const set = new Set(screenerData.map(d => d.sector).filter(Boolean));
    return Array.from(set).sort();
  }, [screenerData]);

  // Apply preset
  const applyPreset = useCallback((preset: CspFilterPreset) => {
    setActivePreset(preset);
    if (preset === 'all') {
      setFilters({ ...defaultCspOptimizerFilters });
    } else {
      setFilters({ ...defaultCspOptimizerFilters, ...FILTER_PRESETS[preset] });
    }
  }, []);

  // Toggle ticker selection
  const toggleTicker = useCallback((ticker: string) => {
    setSelectedTickers(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }, []);

  // Select top N unique tickers by score
  const selectTopN = useCallback((n: number) => {
    const seen = new Set<string>();
    for (const d of sortedData) {
      seen.add(d.ticker);
      if (seen.size >= n) break;
    }
    setSelectedTickers(seen);
  }, [sortedData]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedTickers(new Set());
  }, []);

  // Toggle sort
  const toggleSort = useCallback((key: keyof CspOpportunity) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }, [sortKey]);

  // Run AI analysis
  const runAIAnalysis = useCallback(async (tickers?: string[]) => {
    const tickersToAnalyze = tickers || Array.from(selectedTickers);
    if (tickersToAnalyze.length === 0) return;

    setAiLoading(true);
    setAiError(null);
    setAiProgress('Starting analysis...');
    setAiProgressData(null);
    setAiTrace([]);
    setAiTraceMeta(null);
    setAnalyzingTickers(new Set(tickersToAnalyze));

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/ai/csp-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: tickersToAnalyze,
          mode: tickersToAnalyze.length > 1 ? 'batch' : 'single',
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('AI analysis failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

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
                // Mark done tickers
                if (event.message?.endsWith(': done') && event.data?.ticker) {
                  setAnalyzingTickers(prev => {
                    const next = new Set(prev);
                    next.delete(event.data.ticker);
                    return next;
                  });
                  setAnalyzedTickers(prev => new Set(prev).add(event.data.ticker));
                }
              } else if (event.type === 'analysis') {
                const analysis = event.data as CspOptimizerAIAnalysis;
                setAnalyses(prev => new Map(prev).set(analysis.ticker, analysis));
              } else if (event.type === 'error') {
                setAiError(event.message);
              } else if (event.type === 'trace_step') {
                setAiTrace(prev => [...prev, event.data]);
              } else if (event.type === 'trace_complete') {
                setAiTraceMeta(event.data);
              }
            } catch {
              // ignore partial chunk parse errors
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
      setAnalyzingTickers(new Set());
    }
  }, [selectedTickers]);

  return {
    // Screener data
    screenerData: sortedData,
    totalCount: screenerData?.length || 0,
    filteredCount: filteredData.length,
    screenerLoading,
    screenerError: screenerError?.message || null,
    sectors,

    // Filters
    filters,
    setFilters,
    activePreset,
    applyPreset,

    // Selection
    selectedTickers,
    toggleTicker,
    selectTopN,
    clearSelection,

    // Sort
    sortKey,
    sortAsc,
    toggleSort,

    // AI
    analyses,
    aiLoading,
    aiError,
    aiProgress,
    aiProgressData,
    aiTrace,
    aiTraceMeta,
    analyzingTickers,
    analyzedTickers,
    runAIAnalysis,
    analyzeTopN: useCallback((n: number) => {
      const top = sortedData.slice(0, n).map(d => d.ticker);
      if (top.length === 0) return;
      setSelectedTickers(new Set(top));
      runAIAnalysis(top);
    }, [sortedData, runAIAnalysis]),

    // Refresh
    refresh: mutate,
  };
}
