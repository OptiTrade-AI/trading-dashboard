'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { DirectionalTrade, DirectionalExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useDirectionalTrades() {
  const { data: trades = [], error: swrError, isLoading, mutate } = useSWR<DirectionalTrade[]>('/api/directional-trades');
  const error = swrError?.message ?? null;

  const retry = useCallback(() => { mutate(); }, [mutate]);

  const addTrade = useCallback((trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => {
    const newTrade: DirectionalTrade = {
      ...trade,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(trade.entryDate, trade.expiration),
      costAtOpen: trade.entryPrice * 100 * trade.contracts,
      status: 'open',
    };
    mutate(prev => [newTrade, ...(prev || [])], { revalidate: false });
    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding directional trade:', err));
    return newTrade;
  }, [mutate]);

  const closeTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    exitReason: DirectionalExitReason
  ) => {
    mutate(prev => {
      const trade = (prev || []).find(t => t.id === id);
      if (!trade) return prev;
      const creditAtClose = exitPrice * 100 * trade.contracts;
      const updates = {
        status: 'closed' as const,
        exitPrice,
        exitDate,
        exitReason,
        creditAtClose,
      };
      return (prev || []).map(t =>
        t.id === id ? { ...t, ...updates } : t
      );
    }, { revalidate: false });
    // Fire-and-forget — we need contracts from current data for creditAtClose
    const trade = trades.find(t => t.id === id);
    const creditAtClose = exitPrice * 100 * (trade?.contracts || 0);
    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'closed', exitPrice, exitDate, exitReason, creditAtClose }),
    }).catch(err => console.error('Error closing directional trade:', err));
  }, [mutate, trades]);

  const deleteTrade = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(trade => trade.id !== id), { revalidate: false });
    fetch('/api/directional-trades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting directional trade:', err));
  }, [mutate]);

  const rollTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newTradeData: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    let newTrade: DirectionalTrade | null = null;
    mutate(prev => {
      const currentTrade = (prev || []).find(t => t.id === id);
      if (!currentTrade) return prev;

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

      newTrade = {
        ...newTradeData,
        id: uuidv4(),
        dteAtEntry: calculateDTEFromEntry(newTradeData.entryDate, newTradeData.expiration),
        costAtOpen: newTradeData.entryPrice * 100 * newTradeData.contracts,
        status: 'open',
        rollChainId,
        rollNumber: currentRollNumber + 1,
      };

      return [
        newTrade,
        ...(prev || []).map(trade =>
          trade.id === id ? { ...trade, ...closeUpdates } : trade
        ),
      ];
    }, { revalidate: false });

    if (!newTrade) return null;

    const currentTrade = trades.find(t => t.id === id);
    const rollChainId = currentTrade?.rollChainId || (newTrade as DirectionalTrade).rollChainId!;
    const currentRollNumber = currentTrade?.rollNumber || 1;
    const creditAtClose = exitPrice * 100 * (currentTrade?.contracts || 0);

    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: 'closed',
        exitPrice,
        exitDate,
        exitReason: 'rolled',
        creditAtClose,
        rollChainId,
        rollNumber: currentRollNumber,
      }),
    }).catch(err => console.error('Error closing rolled trade:', err));

    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding rolled trade:', err));

    return newTrade;
  }, [mutate, trades]);

  const partialCloseTrade = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: DirectionalExitReason
  ) => {
    let closedPortion: DirectionalTrade | null = null;
    mutate(prev => {
      const trade = (prev || []).find(t => t.id === id);
      if (!trade || contractsToClose >= trade.contracts || contractsToClose < 1) return prev;

      const totalContracts = trade.originalContracts || trade.contracts;
      const remaining = trade.contracts - contractsToClose;
      const ratio = contractsToClose / trade.contracts;
      const creditAtClose = exitPrice * 100 * contractsToClose;

      closedPortion = {
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

      const remainingUpdates = {
        contracts: remaining,
        costAtOpen: trade.costAtOpen * (1 - ratio),
        originalContracts: totalContracts,
      };

      return [
        closedPortion,
        ...(prev || []).map(t => t.id === id ? { ...t, ...remainingUpdates } : t),
      ];
    }, { revalidate: false });

    if (!closedPortion) return null;

    const trade = trades.find(t => t.id === id);
    const totalContracts = trade?.originalContracts || trade?.contracts || 0;
    const remaining = (trade?.contracts || 0) - contractsToClose;
    const ratio = contractsToClose / (trade?.contracts || 1);

    fetch('/api/directional-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close trade:', err));

    fetch('/api/directional-trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        contracts: remaining,
        costAtOpen: (trade?.costAtOpen || 0) * (1 - ratio),
        originalContracts: totalContracts,
      }),
    }).catch(err => console.error('Error updating remaining trade:', err));

    return closedPortion;
  }, [mutate, trades]);

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
