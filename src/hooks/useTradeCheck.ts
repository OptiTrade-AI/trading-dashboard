'use client';

import { useState, useCallback } from 'react';
import type { TradeCheckResult } from '@/types';

interface TradeCheckRequest {
  ticker: string;
  strategy: string;
  strike?: number;
  contracts: number;
  expiration: string;
  premium?: number;
  collateral?: number;
  costAtOpen?: number;
  entryPrice?: number;
  spreadType?: string;
  longStrike?: number;
  shortStrike?: number;
  netDebit?: number;
  maxLoss?: number;
}

export function useTradeCheck() {
  const [result, setResult] = useState<TradeCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkTrade = useCallback(async (trade: TradeCheckRequest) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/ai/trade-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to check trade');
      }

      const data: TradeCheckResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isLoading, error, checkTrade, reset };
}
