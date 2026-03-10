'use client';

import { useState, useEffect, useCallback } from 'react';
import { TradeAnalysis } from '@/types';

const METADATA_DELIMITER = '\n---METADATA---\n';

interface UseTradeAnalysisReturn {
  analysis: string;
  isAnalyzing: boolean;
  isAvailable: boolean;
  isCheckingAvailability: boolean;
  error: string | null;
  generateAnalysis: (timeRange: string, startDate?: string, endDate?: string) => Promise<void>;
  clearAnalysis: () => void;
  history: TradeAnalysis[];
  isLoadingHistory: boolean;
  selectedAnalysis: TradeAnalysis | null;
  selectAnalysis: (analysis: TradeAnalysis | null) => void;
  deleteAnalysis: (id: string) => Promise<void>;
}

export function useTradeAnalysis(): UseTradeAnalysisReturn {
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TradeAnalysis[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<TradeAnalysis | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis');
      const data = await res.json();
      setIsAvailable(data.available);
      setHistory(data.history || []);
    } catch {
      setIsAvailable(false);
    } finally {
      setIsCheckingAvailability(false);
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const generateAnalysis = useCallback(async (timeRange: string, startDate?: string, endDate?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis('');
    setSelectedAnalysis(null);

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRange, startDate, endDate }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Strip metadata from display while streaming
        const metaIdx = accumulated.indexOf(METADATA_DELIMITER);
        if (metaIdx !== -1) {
          setAnalysis(accumulated.slice(0, metaIdx));
        } else {
          setAnalysis(accumulated);
        }
      }

      // Final strip of metadata
      const metaIdx = accumulated.indexOf(METADATA_DELIMITER);
      if (metaIdx !== -1) {
        setAnalysis(accumulated.slice(0, metaIdx));
      }

      // Re-fetch history to include the new analysis
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [fetchHistory]);

  const clearAnalysis = useCallback(() => {
    setAnalysis('');
    setError(null);
    setSelectedAnalysis(null);
  }, []);

  const selectAnalysis = useCallback((a: TradeAnalysis | null) => {
    setSelectedAnalysis(a);
    if (a) {
      setAnalysis(a.content);
      setError(null);
    } else {
      setAnalysis('');
    }
  }, []);

  const deleteAnalysis = useCallback(async (id: string) => {
    await fetch('/api/analysis', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    // If we deleted the currently viewed analysis, clear it
    if (selectedAnalysis?.id === id) {
      setSelectedAnalysis(null);
      setAnalysis('');
    }
    await fetchHistory();
  }, [fetchHistory, selectedAnalysis]);

  return {
    analysis, isAnalyzing, isAvailable, isCheckingAvailability, error,
    generateAnalysis, clearAnalysis,
    history, isLoadingHistory, selectedAnalysis, selectAnalysis, deleteAnalysis,
  };
}
