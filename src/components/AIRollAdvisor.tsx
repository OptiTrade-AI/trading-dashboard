'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { RollRecommendation } from '@/types';

interface AIRollAdvisorProps {
  position: {
    ticker: string;
    strategy: string;
    strike: number;
    contracts: number;
    expiration: string;
    entryDate: string;
    premiumCollected?: number;
    collateral?: number;
    costAtOpen?: number;
    entryPrice?: number;
    spreadType?: string;
    longStrike?: number;
    shortStrike?: number;
    rollNumber?: number;
  };
  greeks?: {
    delta?: number | null;
    theta?: number | null;
    iv?: number | null;
    bid?: number | null;
    ask?: number | null;
    midpoint?: number | null;
    unrealizedPL?: number | null;
  };
  stockPrice?: number | null;
  onApply?: (rec: RollRecommendation) => void;
}

export function AIRollAdvisor({ position, greeks, stockPrice, onApply }: AIRollAdvisorProps) {
  const [recommendation, setRecommendation] = useState<RollRecommendation & { hasChainData?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/roll-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position, greeks, stockPrice }),
      });

      if (!res.ok) {
        throw new Error('Failed to get recommendation');
      }

      const data = await res.json();
      setRecommendation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [position, greeks, stockPrice]);

  return (
    <div className="space-y-2">
      {!recommendation && !isLoading && (
        <button
          type="button"
          onClick={getRecommendation}
          className={cn(
            'w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2',
            'border border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10'
          )}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          AI Roll Suggestion
        </button>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-xs text-muted">Getting roll suggestion...</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-loss text-center py-1">{error}</div>
      )}

      {recommendation && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400">AI Suggestion</span>
            <button
              type="button"
              onClick={() => setRecommendation(null)}
              className="text-[10px] text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted">Strike:</span>
              <span className="text-foreground ml-1 font-medium">${recommendation.targetStrike}</span>
            </div>
            <div>
              <span className="text-muted">Exp:</span>
              <span className="text-foreground ml-1 font-medium">{recommendation.targetExpiration}</span>
            </div>
            {recommendation.expectedCredit > 0 && (
              <div className="col-span-2">
                <span className="text-muted">Est. Credit:</span>
                <span className="text-profit ml-1 font-medium">${recommendation.expectedCredit.toFixed(2)}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-foreground/70">{recommendation.reasoning}</p>
          {recommendation.hasChainData && (
            <div className="flex items-center gap-1 text-[10px] text-profit/60">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
              Based on live market data
            </div>
          )}
          {onApply && (
            <button
              type="button"
              onClick={() => onApply(recommendation)}
              className="w-full py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
            >
              Use suggestion
            </button>
          )}
        </div>
      )}
    </div>
  );
}
