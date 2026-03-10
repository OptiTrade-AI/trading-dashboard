'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { StockEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function useStockEvents() {
  const { data: stockEvents = [], error: swrError, isLoading, mutate } = useSWR<StockEvent[]>('/api/stock-events');
  const error = swrError?.message ?? null;

  const retry = useCallback(() => { mutate(); }, [mutate]);

  const addStockEvent = useCallback((event: Omit<StockEvent, 'id' | 'realizedPL'>) => {
    const newEvent: StockEvent = {
      ...event,
      id: uuidv4(),
      realizedPL: (event.salePrice - event.costBasis) * event.shares,
    };
    mutate(prev => [newEvent, ...(prev || [])], { revalidate: false });
    fetch('/api/stock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    }).catch(err => console.error('Error adding stock event:', err));
    return newEvent;
  }, [mutate]);

  const deleteStockEvent = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(e => e.id !== id), { revalidate: false });
    fetch('/api/stock-events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting stock event:', err));
  }, [mutate]);

  const totalStockPL = stockEvents.reduce((sum, e) => sum + e.realizedPL, 0);
  const tlhEvents = stockEvents.filter(e => e.isTaxLossHarvest);
  const totalHarvestedLosses = tlhEvents.reduce((sum, e) => sum + e.realizedPL, 0);

  return {
    stockEvents,
    totalStockPL,
    tlhEvents,
    totalHarvestedLosses,
    isLoading,
    error,
    retry,
    addStockEvent,
    deleteStockEvent,
  };
}
