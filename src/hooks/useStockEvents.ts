'use client';

import { useState, useEffect, useCallback } from 'react';
import { StockEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function useStockEvents() {
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/stock-events');
        if (!res.ok) throw new Error('Failed to load stock events');
        const data = await res.json();
        setStockEvents(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load stock events';
        setError(message);
        console.error('Error loading stock events:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch('/api/stock-events')
      .then(async (res) => {
        if (res.ok) setStockEvents(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stock events'))
      .finally(() => setIsLoading(false));
  }, []);

  const addStockEvent = useCallback((event: Omit<StockEvent, 'id' | 'realizedPL'>) => {
    const newEvent: StockEvent = {
      ...event,
      id: uuidv4(),
      realizedPL: (event.salePrice - event.costBasis) * event.shares,
    };
    setStockEvents(prev => [newEvent, ...prev]);
    fetch('/api/stock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    }).catch(err => console.error('Error adding stock event:', err));
    return newEvent;
  }, []);

  const deleteStockEvent = useCallback((id: string) => {
    setStockEvents(prev => prev.filter(e => e.id !== id));
    fetch('/api/stock-events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting stock event:', err));
  }, []);

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
