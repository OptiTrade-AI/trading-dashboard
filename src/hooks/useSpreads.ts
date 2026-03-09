'use client';

import { useState, useEffect, useCallback } from 'react';
import { SpreadTrade, SpreadExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useSpreads() {
  const [spreads, setSpreads] = useState<SpreadTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/spreads');
        if (!res.ok) throw new Error('Failed to load spreads');
        const data = await res.json();
        setSpreads(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        console.error('Error loading spreads:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch('/api/spreads')
      .then(async (res) => {
        if (res.ok) setSpreads(await res.json());
        else throw new Error('Failed to load');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, []);

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
    setSpreads(prev => [newTrade, ...prev]);
    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding spread:', err));
    return newTrade;
  }, []);

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
    setSpreads(prev => prev.map(trade =>
      trade.id === id ? { ...trade, ...updates } : trade
    ));
    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing spread:', err));
  }, []);

  const deleteSpread = useCallback((id: string) => {
    setSpreads(prev => prev.filter(trade => trade.id !== id));
    fetch('/api/spreads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting spread:', err));
  }, []);

  const rollSpread = useCallback((
    id: string,
    closeNetCredit: number,
    exitDate: string,
    newSpreadData: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    const currentSpread = spreads.find(s => s.id === id);
    if (!currentSpread) return null;

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
    setSpreads(prev => prev.map(trade =>
      trade.id === id ? { ...trade, ...closeUpdates } : trade
    ));
    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...closeUpdates }),
    }).catch(err => console.error('Error closing rolled spread:', err));

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

    const newSpread: SpreadTrade = {
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
    setSpreads(prev => [newSpread, ...prev]);
    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSpread),
    }).catch(err => console.error('Error adding rolled spread:', err));

    return newSpread;
  }, [spreads]);

  const partialCloseSpread = useCallback((
    id: string,
    contractsToClose: number,
    closeNetCredit: number,
    exitDate: string,
    exitReason: SpreadExitReason
  ) => {
    const spread = spreads.find(s => s.id === id);
    if (!spread || contractsToClose >= spread.contracts || contractsToClose < 1) return null;

    const totalContracts = spread.originalContracts || spread.contracts;
    const remaining = spread.contracts - contractsToClose;

    // Recompute maxProfit/maxLoss for each portion
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

    // Create closed portion
    const closedPortion: SpreadTrade = {
      ...spread,
      id: uuidv4(),
      contracts: contractsToClose,
      netDebit: closedNetDebit,
      maxProfit: closedMaxProfit,
      maxLoss: closedMaxLoss,
      status: 'closed',
      closeNetCredit: closeNetCredit,
      exitDate,
      exitReason,
      originalContracts: totalContracts,
    };

    // Update remaining portion
    const remainingUpdates = {
      contracts: remaining,
      netDebit: remainingNetDebit,
      maxProfit: remainingMaxProfit,
      maxLoss: remainingMaxLoss,
      originalContracts: totalContracts,
    };

    setSpreads(prev => [
      closedPortion,
      ...prev.map(s => s.id === id ? { ...s, ...remainingUpdates } : s),
    ]);

    fetch('/api/spreads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close spread:', err));

    fetch('/api/spreads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...remainingUpdates }),
    }).catch(err => console.error('Error updating remaining spread:', err));

    return closedPortion;
  }, [spreads]);

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
