'use client';

import { StockHolding, CoveredCall, StockPrice } from '@/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface TickerChip {
  ticker: string;
  totalShares: number;
  availableContracts: number;
  costBasis: number;
  currentPrice: number;
  pctUnderwater: number;
}

interface OptimizerTickerStripProps {
  holdings: StockHolding[];
  openCalls: CoveredCall[];
  stockPrices: Map<string, StockPrice>;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
  onAnalyzeAll: () => void;
  aiLoading: boolean;
  privacyMode: boolean;
}

export function OptimizerTickerStrip({
  holdings,
  openCalls,
  stockPrices,
  selectedTicker,
  onSelect,
  onAnalyzeAll,
  aiLoading,
  privacyMode,
}: OptimizerTickerStripProps) {
  const chips = useMemo(() => {
    // Group holdings by ticker
    const byTicker: Record<string, StockHolding[]> = {};
    for (const h of holdings) {
      const key = h.ticker.toUpperCase();
      if (!byTicker[key]) byTicker[key] = [];
      byTicker[key].push(h);
    }

    // Count covered shares
    const coveredByTicker: Record<string, number> = {};
    for (const c of openCalls) {
      const key = c.ticker.toUpperCase();
      coveredByTicker[key] = (coveredByTicker[key] || 0) + c.sharesHeld;
    }

    const result: TickerChip[] = [];
    for (const [ticker, lots] of Object.entries(byTicker)) {
      const totalShares = lots.reduce((s, l) => s + l.shares, 0);
      const totalCost = lots.reduce((s, l) => s + l.shares * l.costBasisPerShare, 0);
      const costBasis = totalCost / totalShares;
      const coveredShares = coveredByTicker[ticker] || 0;
      const uncoveredShares = Math.max(0, totalShares - coveredShares);
      const availableContracts = Math.floor(uncoveredShares / 100);

      if (availableContracts === 0) continue; // Skip fully covered

      const price = stockPrices.get(ticker);
      const currentPrice = price?.price || 0;
      const pctUnderwater = currentPrice > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0;

      result.push({ ticker, totalShares, availableContracts, costBasis, currentPrice, pctUnderwater });
    }

    // Sort: most underwater first
    return result.sort((a, b) => a.pctUnderwater - b.pctUnderwater);
  }, [holdings, openCalls, stockPrices]);

  const mask = (val: string) => privacyMode ? '***' : val;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
      <button
        onClick={onAnalyzeAll}
        disabled={aiLoading || chips.length === 0}
        className={cn(
          'shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
          'bg-purple-500/15 text-purple-400 border border-purple-500/30',
          'hover:bg-purple-500/25 hover:border-purple-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {aiLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </span>
        ) : (
          <>AI Analyze All</>
        )}
      </button>

      <div className="w-px h-8 bg-border shrink-0" />

      {chips.map((chip) => {
        const isSelected = selectedTicker === chip.ticker;
        const colorClass = chip.pctUnderwater < -30
          ? 'border-red-500/40 bg-red-500/10'
          : chip.pctUnderwater < -10
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-emerald-500/40 bg-emerald-500/10';

        return (
          <button
            key={chip.ticker}
            onClick={() => onSelect(chip.ticker)}
            className={cn(
              'shrink-0 px-3 py-2 rounded-xl text-left transition-all border',
              isSelected
                ? 'ring-2 ring-accent border-accent/50 bg-accent/10'
                : colorClass + ' hover:opacity-80',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{chip.ticker}</span>
              <span className={cn(
                'text-xs font-semibold',
                chip.pctUnderwater < -30 ? 'text-red-400' :
                chip.pctUnderwater < -10 ? 'text-amber-400' :
                chip.pctUnderwater < 0 ? 'text-amber-300' : 'text-emerald-400',
              )}>
                {mask(chip.pctUnderwater.toFixed(1) + '%')}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted">{mask('$' + chip.currentPrice.toFixed(2))}</span>
              <span className="text-xs text-muted/60">|</span>
              <span className="text-xs text-muted">{chip.availableContracts}c</span>
            </div>
          </button>
        );
      })}

      {chips.length === 0 && (
        <p className="text-sm text-muted">No uncovered holdings available for optimization.</p>
      )}
    </div>
  );
}
