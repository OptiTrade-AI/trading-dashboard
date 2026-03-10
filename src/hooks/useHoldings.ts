'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { StockHolding } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function useHoldings() {
  const { data: holdings = [], error: swrError, isLoading, mutate } = useSWR<StockHolding[]>('/api/holdings');
  const error = swrError?.message ?? null;

  const retry = useCallback(() => { mutate(); }, [mutate]);

  const addHolding = useCallback((holding: Omit<StockHolding, 'id'>) => {
    const newHolding: StockHolding = {
      ...holding,
      id: uuidv4(),
    };
    mutate(prev => [newHolding, ...(prev || [])], { revalidate: false });
    fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newHolding),
    }).catch(err => console.error('Error adding holding:', err));
    return newHolding;
  }, [mutate]);

  const updateHolding = useCallback((id: string, updates: Partial<Omit<StockHolding, 'id'>>) => {
    mutate(prev => (prev || []).map(h => h.id === id ? { ...h, ...updates } : h), { revalidate: false });
    fetch('/api/holdings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error updating holding:', err));
  }, [mutate]);

  const deleteHolding = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(h => h.id !== id), { revalidate: false });
    fetch('/api/holdings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting holding:', err));
  }, [mutate]);

  const removeShares = useCallback((ticker: string, sharesToRemove: number) => {
    const lots = holdings
      .filter(h => h.ticker.toUpperCase() === ticker.toUpperCase())
      .sort((a, b) => new Date(a.acquiredDate).getTime() - new Date(b.acquiredDate).getTime());
    if (lots.length === 0) return;

    let remaining = sharesToRemove;
    for (const lot of lots) {
      if (remaining <= 0) break;
      if (lot.shares <= remaining) {
        remaining -= lot.shares;
        deleteHolding(lot.id);
      } else {
        updateHolding(lot.id, { shares: lot.shares - remaining });
        remaining = 0;
      }
    }
  }, [holdings, deleteHolding, updateHolding]);

  const holdingsByTicker = useMemo(() => {
    const grouped: Record<string, StockHolding[]> = {};
    for (const h of holdings) {
      const key = h.ticker.toUpperCase();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(h);
    }
    return grouped;
  }, [holdings]);

  const getCostBasis = useCallback((ticker: string, sharesNeeded: number): number | null => {
    const lots = holdings.filter(h => h.ticker.toUpperCase() === ticker.toUpperCase());
    if (lots.length === 0) return null;

    const totalShares = lots.reduce((sum, h) => sum + h.shares, 0);
    if (totalShares < sharesNeeded) return null;

    const totalCost = lots.reduce((sum, h) => sum + h.shares * h.costBasisPerShare, 0);
    const weightedAvgPerShare = totalCost / totalShares;
    return weightedAvgPerShare * sharesNeeded;
  }, [holdings]);

  const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.shares * h.costBasisPerShare, 0);
  const uniqueTickers = Object.keys(holdingsByTicker).length;
  const avgCostPerShare = totalShares > 0 ? totalCostBasis / totalShares : 0;

  return {
    holdings,
    holdingsByTicker,
    totalShares,
    totalCostBasis,
    uniqueTickers,
    avgCostPerShare,
    isLoading,
    error,
    retry,
    addHolding,
    updateHolding,
    deleteHolding,
    getCostBasis,
    removeShares,
  };
}
