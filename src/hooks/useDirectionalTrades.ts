'use client';

import { useState, useEffect, useCallback } from 'react';
import { DirectionalTrade, DirectionalExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useDirectionalTrades() {
  const [trades, setTrades] = useState<DirectionalTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/directional-trades');
        if (!res.ok) throw new Error('Failed to load directional trades');
        const data = await res.json();
        setTrades(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        console.error('Error loading directional trades:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch('/api/directional-trades')
      .then(async (res) => {
        if (res.ok) setTrades(await res.json());
        else throw new Error('Failed to load');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, []);

  const addTrade = useCallback((trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => {
    const newTrade: DirectionalTrade = {
      ...trade,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(trade.entryDate, trade.expiration),
      costAtOpen: trade.entryPrice * 100 * trade.contracts,
      status: 'open',
    };
    setTrades(prev => [newTrade, ...prev]);
    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding directional trade:', err));
    return newTrade;
  }, []);

  const closeTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    exitReason: DirectionalExitReason
  ) => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;

    const creditAtClose = exitPrice * 100 * trade.contracts;
    const updates = {
      status: 'closed' as const,
      exitPrice,
      exitDate,
      exitReason,
      creditAtClose,
    };

    setTrades(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing directional trade:', err));
  }, [trades]);

  const deleteTrade = useCallback((id: string) => {
    setTrades(prev => prev.filter(trade => trade.id !== id));
    fetch('/api/directional-trades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting directional trade:', err));
  }, []);

  const rollTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newTradeData: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    const currentTrade = trades.find(t => t.id === id);
    if (!currentTrade) return null;

    const rollChainId = currentTrade.rollChainId || uuidv4();
    const currentRollNumber = currentTrade.rollNumber || 1;
    const creditAtClose = exitPrice * 100 * currentTrade.contracts;

    const closeUpdates = {
      status: 'closed' as const,
      exitPrice,
      exitDate,
      exitReason: 'rolled' as const,
      creditAtClose,
      rollChainId,
      rollNumber: currentRollNumber,
    };
    setTrades(prev => prev.map(trade =>
      trade.id === id ? { ...trade, ...closeUpdates } : trade
    ));
    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...closeUpdates }),
    }).catch(err => console.error('Error closing rolled trade:', err));

    const newTrade: DirectionalTrade = {
      ...newTradeData,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(newTradeData.entryDate, newTradeData.expiration),
      costAtOpen: newTradeData.entryPrice * 100 * newTradeData.contracts,
      status: 'open',
      rollChainId,
      rollNumber: currentRollNumber + 1,
    };
    setTrades(prev => [newTrade, ...prev]);
    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding rolled trade:', err));

    return newTrade;
  }, [trades]);

  const partialCloseTrade = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: DirectionalExitReason
  ) => {
    const trade = trades.find(t => t.id === id);
    if (!trade || contractsToClose >= trade.contracts || contractsToClose < 1) return null;

    const totalContracts = trade.originalContracts || trade.contracts;
    const remaining = trade.contracts - contractsToClose;
    const ratio = contractsToClose / trade.contracts;

    const creditAtClose = exitPrice * 100 * contractsToClose;

    // Create closed portion
    const closedPortion: DirectionalTrade = {
      ...trade,
      id: uuidv4(),
      contracts: contractsToClose,
      costAtOpen: trade.costAtOpen * ratio,
      status: 'closed',
      exitPrice,
      exitDate,
      exitReason,
      creditAtClose,
      originalContracts: totalContracts,
    };

    // Update remaining portion
    const remainingUpdates = {
      contracts: remaining,
      costAtOpen: trade.costAtOpen * (1 - ratio),
      originalContracts: totalContracts,
    };

    setTrades(prev => [
      closedPortion,
      ...prev.map(t => t.id === id ? { ...t, ...remainingUpdates } : t),
    ]);

    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close trade:', err));

    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...remainingUpdates }),
    }).catch(err => console.error('Error updating remaining trade:', err));

    return closedPortion;
  }, [trades]);

  const getRollChain = useCallback((rollChainId: string) => {
    return trades
      .filter(t => t.rollChainId === rollChainId)
      .sort((a, b) => (a.rollNumber || 1) - (b.rollNumber || 1));
  }, [trades]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  return {
    trades,
    openTrades,
    closedTrades,
    isLoading,
    error,
    retry,
    addTrade,
    closeTrade,
    deleteTrade,
    rollTrade,
    partialCloseTrade,
    getRollChain,
  };
}
