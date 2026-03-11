'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface TradeHookConfig<T extends { id: string; status: string; entryDate: string; expiration: string; contracts: number; rollChainId?: string; rollNumber?: number; originalContracts?: number }> {
  apiEndpoint: string;
  /** Compute derived fields when adding a new item (e.g. collateral, DTE) */
  prepareNew: (input: Record<string, unknown>) => T;
  /** Build update payload when closing an item */
  prepareClose: (item: T, ...closeArgs: unknown[]) => Partial<T>;
  /** Build both the closed portion and remaining-item updates for partial close */
  preparePartialClose: (item: T, contractsToClose: number, ...closeArgs: unknown[]) => {
    closedPortion: Partial<T>;
    remainingUpdates: Partial<T>;
  };
  /** Determine open vs not-open (CC uses 'called' as a non-open status) */
  isOpen: (item: T) => boolean;
}

export function createTradeHook<T extends {
  id: string;
  status: string;
  entryDate: string;
  expiration: string;
  contracts: number;
  rollChainId?: string;
  rollNumber?: number;
  originalContracts?: number;
}>(config: TradeHookConfig<T>) {
  return function useTradeData() {
    const { data: items = [], error: swrError, isLoading, mutate } = useSWR<T[]>(config.apiEndpoint);
    const error = swrError?.message ?? null;
    const toast = useToast();

    const retry = useCallback(() => { mutate(); }, [mutate]);

    const addItem = useCallback((input: Record<string, unknown>) => {
      const newItem = config.prepareNew(input);
      const ticker = (input.ticker as string) || '';
      mutate(prev => [newItem, ...(prev || [])], { revalidate: false });
      fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })
        .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success(`${ticker} trade added`); })
        .catch(err => { console.error(`Error adding item:`, err); toast.error(`Failed to add trade`); });
      return newItem;
    }, [mutate, toast]);

    const closeItem = useCallback((id: string, ...closeArgs: unknown[]) => {
      mutate(prev => {
        const item = (prev || []).find(t => t.id === id);
        if (!item) return prev;
        const updates = config.prepareClose(item, ...closeArgs);
        return (prev || []).map(t => t.id === id ? { ...t, ...updates } : t);
      }, { revalidate: false });

      const item = items.find(t => t.id === id);
      if (!item) return;
      const ticker = (item as Record<string, unknown>).ticker as string || '';
      const updates = config.prepareClose(item, ...closeArgs);
      fetch(config.apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
        .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success(`${ticker} position closed`); })
        .catch(err => { console.error(`Error closing item:`, err); toast.error(`Failed to close position`); });
    }, [mutate, items, toast]);

    const deleteItem = useCallback((id: string) => {
      mutate(prev => (prev || []).filter(item => item.id !== id), { revalidate: false });
      fetch(config.apiEndpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
        .then(res => { if (!res.ok) throw new Error('Delete failed'); toast.success(`Trade deleted`); })
        .catch(err => { console.error(`Error deleting item:`, err); toast.error(`Failed to delete trade`); });
    }, [mutate, toast]);

    const rollItem = useCallback((
      id: string,
      closeArgs: unknown[],
      newItemData: Record<string, unknown>
    ) => {
      let newItem: T | null = null;
      mutate(prev => {
        const currentItem = (prev || []).find(t => t.id === id);
        if (!currentItem) return prev;

        const rollChainId = currentItem.rollChainId || uuidv4();
        const currentRollNumber = currentItem.rollNumber || 1;

        const closeUpdates = config.prepareClose(currentItem, ...closeArgs);
        const rollCloseUpdates = {
          ...closeUpdates,
          rollChainId,
          rollNumber: currentRollNumber,
        } as Partial<T>;
        // Force exitReason to 'rolled' for trade types that support it
        if ('exitReason' in (closeUpdates as Record<string, unknown>)) {
          (rollCloseUpdates as Record<string, unknown>).exitReason = 'rolled';
        }

        newItem = config.prepareNew({
          ...newItemData,
          rollChainId,
          rollNumber: currentRollNumber + 1,
        });

        return [
          newItem,
          ...(prev || []).map(t => t.id === id ? { ...t, ...rollCloseUpdates } : t),
        ];
      }, { revalidate: false });

      if (!newItem) return null;

      const currentItem = items.find(t => t.id === id);
      const rollChainId = currentItem?.rollChainId || (newItem as T).rollChainId!;
      const currentRollNumber = currentItem?.rollNumber || 1;

      const closeUpdates = currentItem ? config.prepareClose(currentItem, ...closeArgs) : {};
      const ticker = (currentItem as Record<string, unknown>)?.ticker as string || '';
      fetch(config.apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...closeUpdates,
          exitReason: 'rolled',
          rollChainId,
          rollNumber: currentRollNumber,
        }),
      }).catch(err => { console.error('Error closing rolled item:', err); toast.error('Failed to roll position'); });

      fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })
        .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success(`${ticker} position rolled`); })
        .catch(err => { console.error('Error adding rolled item:', err); toast.error('Failed to roll position'); });

      return newItem;
    }, [mutate, items, toast]);

    const partialCloseItem = useCallback((
      id: string,
      contractsToClose: number,
      ...closeArgs: unknown[]
    ) => {
      let closedPortion: T | null = null;
      mutate(prev => {
        const item = (prev || []).find(t => t.id === id);
        if (!item || contractsToClose >= item.contracts || contractsToClose < 1) return prev;

        const totalContracts = item.originalContracts || item.contracts;
        const { closedPortion: closedPartial, remainingUpdates } = config.preparePartialClose(item, contractsToClose, ...closeArgs);

        closedPortion = {
          ...item,
          ...closedPartial,
          id: uuidv4(),
          contracts: contractsToClose,
          originalContracts: totalContracts,
        } as T;

        return [
          closedPortion,
          ...(prev || []).map(t => t.id === id ? { ...t, ...remainingUpdates, originalContracts: totalContracts } : t),
        ];
      }, { revalidate: false });

      if (!closedPortion) return null;

      const item = items.find(t => t.id === id);
      if (!item) return closedPortion;

      const totalContracts = item.originalContracts || item.contracts;
      const { remainingUpdates } = config.preparePartialClose(item, contractsToClose, ...closeArgs);

      const ticker = (item as Record<string, unknown>).ticker as string || '';
      fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closedPortion),
      })
        .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success(`${ticker} partially closed`); })
        .catch(err => { console.error('Error adding partial close:', err); toast.error('Failed to partial close'); });

      fetch(config.apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...remainingUpdates,
          originalContracts: totalContracts,
        }),
      }).catch(err => { console.error('Error updating remaining:', err); toast.error('Failed to update remaining'); });

      return closedPortion;
    }, [mutate, items, toast]);

    const editItem = useCallback((id: string, updates: Partial<T>) => {
      mutate(prev => (prev || []).map(t => t.id === id ? { ...t, ...updates } : t), { revalidate: false });
      fetch(config.apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
        .then(res => { if (!res.ok) throw new Error('Save failed'); toast.success('Trade updated'); })
        .catch(err => { console.error(`Error editing item:`, err); toast.error('Failed to update trade'); });
    }, [mutate, toast]);

    const getRollChain = useCallback((rollChainId: string) => {
      return items
        .filter(t => t.rollChainId === rollChainId)
        .sort((a, b) => (a.rollNumber || 1) - (b.rollNumber || 1));
    }, [items]);

    const openItems = items.filter(config.isOpen);
    const closedItems = items.filter(t => !config.isOpen(t));

    return {
      items,
      openItems,
      closedItems,
      isLoading,
      error,
      retry,
      addItem,
      editItem,
      closeItem,
      deleteItem,
      rollItem,
      partialCloseItem,
      getRollChain,
      mutate,
    };
  };
}

// Helper to compute DTE from entry for all trade types
export function computeDTE(entryDate: string, expiration: string) {
  return calculateDTEFromEntry(entryDate, expiration);
}
