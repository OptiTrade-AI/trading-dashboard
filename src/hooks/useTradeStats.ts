import { useMemo, useCallback } from 'react';

export interface TradeStats {
  totalPL: number;
  wins: number;
  losses: number;
  winRate: number;
  openCount: number;
  closedCount: number;
}

export function useTradeStats<T>(
  openItems: T[],
  closedItems: T[],
  calculatePL: (item: T) => number,
): TradeStats {
  // Stabilize the callback reference to avoid recalculating on every render
  // when callers pass an inline function. The caller's calculatePL should be
  // a stable reference (imported util), but we wrap it just in case.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stablePL = useCallback(calculatePL, []);

  return useMemo(() => {
    const totalPL = closedItems.reduce((sum, t) => sum + stablePL(t), 0);
    const wins = closedItems.filter((t) => stablePL(t) > 0).length;
    const winRate = closedItems.length > 0 ? (wins / closedItems.length) * 100 : 0;

    return {
      totalPL,
      wins,
      losses: closedItems.length - wins,
      winRate,
      openCount: openItems.length,
      closedCount: closedItems.length,
    };
  }, [openItems, closedItems, stablePL]);
}
