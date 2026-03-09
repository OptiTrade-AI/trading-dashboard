'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trade, AccountSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry, calculateCollateral } from '@/lib/utils';

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  accountValue: 100000,
  maxHeatPercent: 30,
};

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(DEFAULT_ACCOUNT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [tradesRes, settingsRes] = await Promise.all([
          fetch('/api/trades'),
          fetch('/api/settings')
        ]);

        if (!tradesRes.ok) throw new Error('Failed to load trades');
        if (!settingsRes.ok) throw new Error('Failed to load settings');

        const tradesData = await tradesRes.json();
        const settingsData = await settingsRes.json();
        setTrades(tradesData);
        setAccountSettings(settingsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([fetch('/api/trades'), fetch('/api/settings')])
      .then(async ([tradesRes, settingsRes]) => {
        if (tradesRes.ok) setTrades(await tradesRes.json());
        if (settingsRes.ok) setAccountSettings(await settingsRes.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, []);

  const saveSettings = useCallback(async (newSettings: AccountSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  }, []);

  const addTrade = useCallback((trade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status'>) => {
    const newTrade: Trade = {
      ...trade,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(trade.entryDate, trade.expiration),
      collateral: calculateCollateral(trade.strike, trade.contracts),
      status: 'open',
    };
    setTrades(prev => [newTrade, ...prev]);
    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding trade:', err));
    return newTrade;
  }, []);

  const closeTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    exitReason: Trade['exitReason']
  ) => {
    const updates = { status: 'closed' as const, exitPrice, exitDate, exitReason };
    setTrades(prev => prev.map(trade =>
      trade.id === id ? { ...trade, ...updates } : trade
    ));
    fetch('/api/trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing trade:', err));
  }, []);

  const deleteTrade = useCallback((id: string) => {
    setTrades(prev => prev.filter(trade => trade.id !== id));
    fetch('/api/trades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting trade:', err));
  }, []);

  const rollTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newTradeData: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    const currentTrade = trades.find(t => t.id === id);
    if (!currentTrade) return null;

    const rollChainId = currentTrade.rollChainId || uuidv4();
    const currentRollNumber = currentTrade.rollNumber || 1;

    // Close the current trade
    const closeUpdates = {
      status: 'closed' as const,
      exitPrice,
      exitDate,
      exitReason: 'rolled' as const,
      rollChainId,
      rollNumber: currentRollNumber,
    };
    setTrades(prev => prev.map(trade =>
      trade.id === id ? { ...trade, ...closeUpdates } : trade
    ));
    fetch('/api/trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...closeUpdates }),
    }).catch(err => console.error('Error closing rolled trade:', err));

    // Create the new rolled position
    const newTrade: Trade = {
      ...newTradeData,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(newTradeData.entryDate, newTradeData.expiration),
      collateral: calculateCollateral(newTradeData.strike, newTradeData.contracts),
      status: 'open',
      rollChainId,
      rollNumber: currentRollNumber + 1,
    };
    setTrades(prev => [newTrade, ...prev]);
    fetch('/api/trades', {
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
    exitReason: Trade['exitReason']
  ) => {
    const trade = trades.find(t => t.id === id);
    if (!trade || contractsToClose >= trade.contracts || contractsToClose < 1) return null;

    const totalContracts = trade.originalContracts || trade.contracts;
    const remaining = trade.contracts - contractsToClose;
    const ratio = contractsToClose / trade.contracts;

    // Create closed portion
    const closedPortion: Trade = {
      ...trade,
      id: uuidv4(),
      contracts: contractsToClose,
      premiumCollected: trade.premiumCollected * ratio,
      collateral: calculateCollateral(trade.strike, contractsToClose),
      status: 'closed',
      exitPrice: exitPrice * ratio,
      exitDate,
      exitReason,
      originalContracts: totalContracts,
    };

    // Update remaining portion
    const remainingUpdates = {
      contracts: remaining,
      premiumCollected: trade.premiumCollected * (1 - ratio),
      collateral: calculateCollateral(trade.strike, remaining),
      originalContracts: totalContracts,
    };

    setTrades(prev => [
      closedPortion,
      ...prev.map(t => t.id === id ? { ...t, ...remainingUpdates } : t),
    ]);

    // POST closed portion, PATCH remaining
    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close trade:', err));

    fetch('/api/trades', {
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

  const updateAccountValue = useCallback((value: number) => {
    const newSettings = { ...accountSettings, accountValue: value };
    setAccountSettings(newSettings);
    saveSettings(newSettings);
  }, [accountSettings, saveSettings]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const totalCollateral = openTrades.reduce((sum, t) => sum + t.collateral, 0);
  const heat = accountSettings.accountValue > 0
    ? (totalCollateral / accountSettings.accountValue) * 100
    : 0;

  return {
    trades,
    openTrades,
    closedTrades,
    accountSettings,
    totalCollateral,
    heat,
    isLoading,
    error,
    retry,
    addTrade,
    closeTrade,
    deleteTrade,
    rollTrade,
    partialCloseTrade,
    getRollChain,
    updateAccountValue,
  };
}
