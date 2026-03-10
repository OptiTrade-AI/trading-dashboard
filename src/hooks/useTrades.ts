'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { Trade, AccountSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry, calculateCollateral } from '@/lib/utils';
import { createTradeHook } from './useTradeData';

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  accountValue: 100000,
  maxHeatPercent: 30,
};

const useTradeBase = createTradeHook<Trade>({
  apiEndpoint: '/api/trades',
  prepareNew: (input) => ({
    ...input,
    id: uuidv4(),
    dteAtEntry: calculateDTEFromEntry(input.entryDate as string, input.expiration as string),
    collateral: calculateCollateral(input.strike as number, input.contracts as number),
    status: 'open',
  } as Trade),
  prepareClose: (_item, exitPrice, exitDate, exitReason) => ({
    status: 'closed' as const,
    exitPrice: exitPrice as number,
    exitDate: exitDate as string,
    exitReason: exitReason as Trade['exitReason'],
  }),
  preparePartialClose: (item, contractsToClose, exitPrice, exitDate, exitReason) => {
    const ratio = contractsToClose / item.contracts;
    const remaining = item.contracts - contractsToClose;
    return {
      closedPortion: {
        premiumCollected: item.premiumCollected * ratio,
        collateral: calculateCollateral(item.strike, contractsToClose),
        status: 'closed' as const,
        exitPrice: (exitPrice as number) * ratio,
        exitDate: exitDate as string,
        exitReason: exitReason as Trade['exitReason'],
      },
      remainingUpdates: {
        contracts: remaining,
        premiumCollected: item.premiumCollected * (1 - ratio),
        collateral: calculateCollateral(item.strike, remaining),
      },
    };
  },
  isOpen: (item) => item.status === 'open',
});

export function useTrades() {
  const base = useTradeBase();
  const { data: accountSettings = DEFAULT_ACCOUNT_SETTINGS, isLoading: setLoading, mutate: mutateSettings } = useSWR<AccountSettings>('/api/settings');

  const isLoading = base.isLoading || setLoading;

  const retry = useCallback(() => {
    base.retry();
    mutateSettings();
  }, [base, mutateSettings]);

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
    return base.addItem(trade);
  }, [base]);

  const editTrade = useCallback((id: string, updates: Partial<Trade>) => {
    base.editItem(id, updates);
  }, [base]);

  const closeTrade = useCallback((id: string, exitPrice: number, exitDate: string, exitReason: Trade['exitReason']) => {
    base.closeItem(id, exitPrice, exitDate, exitReason);
  }, [base]);

  const deleteTrade = useCallback((id: string) => {
    base.deleteItem(id);
  }, [base]);

  const rollTrade = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newTradeData: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    return base.rollItem(id, [exitPrice, exitDate, 'rolled'], newTradeData);
  }, [base]);

  const partialCloseTrade = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: Trade['exitReason']
  ) => {
    return base.partialCloseItem(id, contractsToClose, exitPrice, exitDate, exitReason);
  }, [base]);

  const updateAccountValue = useCallback((value: number) => {
    const newSettings = { ...accountSettings, accountValue: value };
    mutateSettings(newSettings, { revalidate: false });
    saveSettings(newSettings);
  }, [accountSettings, saveSettings, mutateSettings]);

  const totalCollateral = base.openItems.reduce((sum, t) => sum + t.collateral, 0);
  const heat = accountSettings.accountValue > 0
    ? (totalCollateral / accountSettings.accountValue) * 100
    : 0;

  return {
    trades: base.items,
    openTrades: base.openItems,
    closedTrades: base.closedItems,
    accountSettings,
    totalCollateral,
    heat,
    isLoading,
    error: base.error,
    retry,
    addTrade,
    editTrade,
    closeTrade,
    deleteTrade,
    rollTrade,
    partialCloseTrade,
    getRollChain: base.getRollChain,
    updateAccountValue,
  };
}
