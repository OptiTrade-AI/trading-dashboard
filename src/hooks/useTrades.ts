'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { Trade, AccountSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry, calculateCollateral } from '@/lib/utils';

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  accountValue: 100000,
  maxHeatPercent: 30,
};

export function useTrades() {
  const { data: trades = [], error: trErr, isLoading: trLoading, mutate: mutateTrades } = useSWR<Trade[]>('/api/trades');
  const { data: accountSettings = DEFAULT_ACCOUNT_SETTINGS, isLoading: setLoading, mutate: mutateSettings } = useSWR<AccountSettings>('/api/settings');
  const isLoading = trLoading || setLoading;
  const error = trErr?.message ?? null;

  const retry = useCallback(() => {
    mutateTrades();
    mutateSettings();
  }, [mutateTrades, mutateSettings]);

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
    mutateTrades(prev => [newTrade, ...(prev || [])], { revalidate: false });
    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding trade:', err));
    return newTrade;
  }, [mutateTrades]);

  const closeTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    exitReason: Trade['exitReason']
  ) => {
    const updates = { status: 'closed' as const, exitPrice, exitDate, exitReason };
    mutateTrades(prev => (prev || []).map(trade =>
      trade.id === id ? { ...trade, ...updates } : trade
    ), { revalidate: false });
    fetch('/api/trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing trade:', err));
  }, [mutateTrades]);

  const deleteTrade = useCallback((id: string) => {
    mutateTrades(prev => (prev || []).filter(trade => trade.id !== id), { revalidate: false });
    fetch('/api/trades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting trade:', err));
  }, [mutateTrades]);

  const rollTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newTradeData: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    let newTrade: Trade | null = null;
    mutateTrades(prev => {
      const currentTrade = (prev || []).find(t => t.id === id);
      if (!currentTrade) return prev;

      const rollChainId = currentTrade.rollChainId || uuidv4();
      const currentRollNumber = currentTrade.rollNumber || 1;

      const closeUpdates = {
        status: 'closed' as const,
        exitPrice,
        exitDate,
        exitReason: 'rolled' as const,
        rollChainId,
        rollNumber: currentRollNumber,
      };

      newTrade = {
        ...newTradeData,
        id: uuidv4(),
        dteAtEntry: calculateDTEFromEntry(newTradeData.entryDate, newTradeData.expiration),
        collateral: calculateCollateral(newTradeData.strike, newTradeData.contracts),
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
    const rollChainId = currentTrade?.rollChainId || (newTrade as Trade).rollChainId!;
    const currentRollNumber = currentTrade?.rollNumber || 1;

    fetch('/api/trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: 'closed',
        exitPrice,
        exitDate,
        exitReason: 'rolled',
        rollChainId,
        rollNumber: currentRollNumber,
      }),
    }).catch(err => console.error('Error closing rolled trade:', err));

    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrade),
    }).catch(err => console.error('Error adding rolled trade:', err));

    return newTrade;
  }, [mutateTrades, trades]);

  const partialCloseTrade = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: Trade['exitReason']
  ) => {
    let closedPortion: Trade | null = null;
    mutateTrades(prev => {
      const trade = (prev || []).find(t => t.id === id);
      if (!trade || contractsToClose >= trade.contracts || contractsToClose < 1) return prev;

      const totalContracts = trade.originalContracts || trade.contracts;
      const remaining = trade.contracts - contractsToClose;
      const ratio = contractsToClose / trade.contracts;

      closedPortion = {
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

      const remainingUpdates = {
        contracts: remaining,
        premiumCollected: trade.premiumCollected * (1 - ratio),
        collateral: calculateCollateral(trade.strike, remaining),
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

    fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close trade:', err));

    fetch('/api/trades', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        contracts: remaining,
        premiumCollected: (trade?.premiumCollected || 0) * (1 - ratio),
        collateral: calculateCollateral(trade?.strike || 0, remaining),
        originalContracts: totalContracts,
      }),
    }).catch(err => console.error('Error updating remaining trade:', err));

    return closedPortion;
  }, [mutateTrades, trades]);

  const getRollChain = useCallback((rollChainId: string) => {
    return trades
      .filter(t => t.rollChainId === rollChainId)
      .sort((a, b) => (a.rollNumber || 1) - (b.rollNumber || 1));
  }, [trades]);

  const updateAccountValue = useCallback((value: number) => {
    const newSettings = { ...accountSettings, accountValue: value };
    mutateSettings(newSettings, { revalidate: false });
    saveSettings(newSettings);
  }, [accountSettings, saveSettings, mutateSettings]);

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
