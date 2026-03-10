'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { SpreadTrade, SpreadExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useSpreads() {
  const { data: spreads = [], error: swrError, isLoading, mutate } = useSWR<SpreadTrade[]>('/api/spreads');
  const error = swrError?.message ?? null;

  const retry = useCallback(() => { mutate(); }, [mutate]);

  const addSpread = useCallback((trade: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status'>) => {
    const strikeDiff = Math.abs(trade.longStrike - trade.shortStrike);
    const netDebit = (trade.longPrice - trade.shortPrice) * 100 * trade.contracts;
    const netDebitPerContract = trade.longPrice - trade.shortPrice;

    let maxProfit: number;
    let maxLoss: number;

    if (trade.spreadType === 'call_debit' || trade.spreadType === 'put_debit') {
      maxProfit = (strikeDiff - netDebitPerContract) * 100 * trade.contracts;
      maxLoss = netDebit;
    } else {
      maxProfit = Math.abs(netDebit);
      maxLoss = (strikeDiff - Math.abs(netDebitPerContract)) * 100 * trade.contracts;
    }

    const newTrade: SpreadTrade = {
      ...trade,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(trade.entryDate, trade.expiration),
      netDebit,
      maxProfit,
      maxLoss,
      status: 'open',
    };
    mutate(prev => [newTrade, ...(prev || [])], { revalidate: false });
    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding spread:', err));
    return newTrade;
  }, [mutate]);

  const closeSpread = useCallback((
    id: string,
    closeNetCredit: number,
    exitDate: string,
    exitReason: SpreadExitReason
  ) => {
    const updates = {
      status: 'closed' as const,
      closeNetCredit,
      exitDate,
      exitReason,
    };
    mutate(prev => (prev || []).map(trade =>
      trade.id === id ? { ...trade, ...updates } : trade
    ), { revalidate: false });
    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing spread:', err));
  }, [mutate]);

  const deleteSpread = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(trade => trade.id !== id), { revalidate: false });
    fetch('/api/spreads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting spread:', err));
  }, [mutate]);

  const rollSpread = useCallback((
    id: string,
    closeNetCredit: number,
    exitDate: string,
    newSpreadData: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    let newSpread: SpreadTrade | null = null;
    mutate(prev => {
      const currentSpread = (prev || []).find(s => s.id === id);
      if (!currentSpread) return prev;

      const rollChainId = currentSpread.rollChainId || uuidv4();
      const currentRollNumber = currentSpread.rollNumber || 1;

      const closeUpdates = {
        status: 'closed' as const,
        closeNetCredit,
        exitDate,
        exitReason: 'rolled' as const,
        rollChainId,
        rollNumber: currentRollNumber,
      };

      // Compute new spread values
      const strikeDiff = Math.abs(newSpreadData.longStrike - newSpreadData.shortStrike);
      const netDebit = (newSpreadData.longPrice - newSpreadData.shortPrice) * 100 * newSpreadData.contracts;
      const netDebitPerContract = newSpreadData.longPrice - newSpreadData.shortPrice;
      const isDebit = newSpreadData.spreadType === 'call_debit' || newSpreadData.spreadType === 'put_debit';
      const maxProfit = isDebit
        ? (strikeDiff - netDebitPerContract) * 100 * newSpreadData.contracts
        : Math.abs(netDebit);
      const maxLoss = isDebit
        ? netDebit
        : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * newSpreadData.contracts;

      newSpread = {
        ...newSpreadData,
        id: uuidv4(),
        dteAtEntry: calculateDTEFromEntry(newSpreadData.entryDate, newSpreadData.expiration),
        netDebit,
        maxProfit,
        maxLoss,
        status: 'open',
        rollChainId,
        rollNumber: currentRollNumber + 1,
      };

      return [
        newSpread,
        ...(prev || []).map(trade =>
          trade.id === id ? { ...trade, ...closeUpdates } : trade
        ),
      ];
    }, { revalidate: false });

    if (!newSpread) return null;

    const currentSpread = spreads.find(s => s.id === id);
    const rollChainId = currentSpread?.rollChainId || (newSpread as SpreadTrade).rollChainId!;
    const currentRollNumber = currentSpread?.rollNumber || 1;

    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: 'closed',
        closeNetCredit,
        exitDate,
        exitReason: 'rolled',
        rollChainId,
        rollNumber: currentRollNumber,
      }),
    }).catch(err => console.error('Error closing rolled spread:', err));

    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSpread),
    }).catch(err => console.error('Error adding rolled spread:', err));

    return newSpread;
  }, [mutate, spreads]);

  const partialCloseSpread = useCallback((
    id: string,
    contractsToClose: number,
    closeNetCredit: number,
    exitDate: string,
    exitReason: SpreadExitReason
  ) => {
    let closedPortion: SpreadTrade | null = null;
    mutate(prev => {
      const spread = (prev || []).find(s => s.id === id);
      if (!spread || contractsToClose >= spread.contracts || contractsToClose < 1) return prev;

      const totalContracts = spread.originalContracts || spread.contracts;
      const remaining = spread.contracts - contractsToClose;

      const strikeDiff = Math.abs(spread.longStrike - spread.shortStrike);
      const netDebitPerContract = spread.longPrice - spread.shortPrice;
      const isDebit = spread.spreadType === 'call_debit' || spread.spreadType === 'put_debit';

      const closedNetDebit = netDebitPerContract * 100 * contractsToClose;
      const closedMaxProfit = isDebit
        ? (strikeDiff - netDebitPerContract) * 100 * contractsToClose
        : Math.abs(closedNetDebit);
      const closedMaxLoss = isDebit
        ? closedNetDebit
        : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * contractsToClose;

      const remainingNetDebit = netDebitPerContract * 100 * remaining;
      const remainingMaxProfit = isDebit
        ? (strikeDiff - netDebitPerContract) * 100 * remaining
        : Math.abs(remainingNetDebit);
      const remainingMaxLoss = isDebit
        ? remainingNetDebit
        : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * remaining;

      closedPortion = {
        ...spread,
        id: uuidv4(),
        contracts: contractsToClose,
        netDebit: closedNetDebit,
        maxProfit: closedMaxProfit,
        maxLoss: closedMaxLoss,
        status: 'closed',
        closeNetCredit,
        exitDate,
        exitReason,
        originalContracts: totalContracts,
      };

      const remainingUpdates = {
        contracts: remaining,
        netDebit: remainingNetDebit,
        maxProfit: remainingMaxProfit,
        maxLoss: remainingMaxLoss,
        originalContracts: totalContracts,
      };

      return [
        closedPortion,
        ...(prev || []).map(s => s.id === id ? { ...s, ...remainingUpdates } : s),
      ];
    }, { revalidate: false });

    if (!closedPortion) return null;

    const spread = spreads.find(s => s.id === id);
    const totalContracts = spread?.originalContracts || spread?.contracts || 0;
    const remaining = (spread?.contracts || 0) - contractsToClose;
    const strikeDiff = Math.abs((spread?.longStrike || 0) - (spread?.shortStrike || 0));
    const netDebitPerContract = (spread?.longPrice || 0) - (spread?.shortPrice || 0);
    const isDebit = spread?.spreadType === 'call_debit' || spread?.spreadType === 'put_debit';
    const remainingNetDebit = netDebitPerContract * 100 * remaining;
    const remainingMaxProfit = isDebit
      ? (strikeDiff - netDebitPerContract) * 100 * remaining
      : Math.abs(remainingNetDebit);
    const remainingMaxLoss = isDebit
      ? remainingNetDebit
      : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * remaining;

    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close spread:', err));

    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        contracts: remaining,
        netDebit: remainingNetDebit,
        maxProfit: remainingMaxProfit,
        maxLoss: remainingMaxLoss,
        originalContracts: totalContracts,
      }),
    }).catch(err => console.error('Error updating remaining spread:', err));

    return closedPortion;
  }, [mutate, spreads]);

  const getRollChain = useCallback((rollChainId: string) => {
    return spreads
      .filter(s => s.rollChainId === rollChainId)
      .sort((a, b) => (a.rollNumber || 1) - (b.rollNumber || 1));
  }, [spreads]);

  const openSpreads = spreads.filter(t => t.status === 'open');
  const closedSpreads = spreads.filter(t => t.status === 'closed');

  return {
    spreads,
    openSpreads,
    closedSpreads,
    isLoading,
    error,
    retry,
    addSpread,
    closeSpread,
    deleteSpread,
    rollSpread,
    partialCloseSpread,
    getRollChain,
  };
}
