'use client';

import { useState, useCallback } from 'react';

interface ExitCoachRequest {
  position: {
    id: string;
    ticker: string;
    strategy: string;
    strike: number;
    contracts: number;
    expiration: string;
    entryDate: string;
    premiumCollected?: number;
    entryPrice?: number;
    costAtOpen?: number;
    collateral?: number;
    costBasis?: number;
    spreadType?: string;
    longStrike?: number;
    shortStrike?: number;
    netDebit?: number;
    maxProfit?: number;
    maxLoss?: number;
  };
  greeks?: {
    delta?: number | null;
    gamma?: number | null;
    theta?: number | null;
    vega?: number | null;
    iv?: number | null;
    bid?: number | null;
    ask?: number | null;
    midpoint?: number | null;
    unrealizedPL?: number | null;
  };
  stockPrice?: number | null;
}

export function useExitCoach() {
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAdvice = useCallback(async (req: ExitCoachRequest) => {
    setIsLoading(true);
    setResponse('');
    setError(null);

    try {
      const res = await fetch('/api/ai/exit-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get advice');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setResponse(accumulated);
      }
      accumulated += decoder.decode(); // flush any remaining buffered bytes
      setResponse(accumulated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);

  return { response, isLoading, error, getAdvice, reset };
}
