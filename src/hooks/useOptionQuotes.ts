'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useTrades } from './useTrades';
import { useCoveredCalls } from './useCoveredCalls';
import { useDirectionalTrades } from './useDirectionalTrades';
import { useSpreads } from './useSpreads';
import { useMarketStatus } from './useMarketStatus';
import { OptionQuote } from '@/types';
import { buildOptionSymbol } from '@/lib/utils';

export interface PositionQuoteData {
  unrealizedPL: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  midpoint: number;
  bid: number;
  ask: number;
}

interface SymbolMapping {
  positionId: string;
  entryPrice: number; // per-contract premium/price
  contracts: number;
  direction: 'sold' | 'bought';
  leg?: 'long' | 'short'; // for spreads
}

export function useOptionQuotes() {
  const { openTrades } = useTrades();
  const { openCalls } = useCoveredCalls();
  const { openTrades: openDirectional } = useDirectionalTrades();
  const { openSpreads } = useSpreads();
  const { isOpen } = useMarketStatus();

  // Build symbol-to-position mapping
  const { symbols, symbolMap, spreadPairs } = useMemo(() => {
    const map = new Map<string, SymbolMapping>();
    const pairs = new Map<string, { longSymbol: string; shortSymbol: string; netEntry: number; contracts: number }>();
    const syms = new Set<string>();

    // CSPs — sold puts
    for (const t of openTrades) {
      const sym = buildOptionSymbol(t.ticker, t.expiration, 'P', t.strike);
      syms.add(sym);
      map.set(sym, {
        positionId: t.id,
        entryPrice: t.premiumCollected / (t.contracts * 100),
        contracts: t.contracts,
        direction: 'sold',
      });
    }

    // Covered Calls — sold calls
    for (const c of openCalls) {
      const sym = buildOptionSymbol(c.ticker, c.expiration, 'C', c.strike);
      syms.add(sym);
      map.set(sym, {
        positionId: c.id,
        entryPrice: c.premiumCollected / (c.contracts * 100),
        contracts: c.contracts,
        direction: 'sold',
      });
    }

    // Directional — bought calls/puts
    for (const t of openDirectional) {
      const type = t.optionType === 'call' ? 'C' : 'P';
      const sym = buildOptionSymbol(t.ticker, t.expiration, type, t.strike);
      syms.add(sym);
      map.set(sym, {
        positionId: t.id,
        entryPrice: t.entryPrice,
        contracts: t.contracts,
        direction: 'bought',
      });
    }

    // Spreads — both legs
    for (const s of openSpreads) {
      const isCall = s.spreadType === 'call_debit' || s.spreadType === 'call_credit';
      const optType: 'C' | 'P' = isCall ? 'C' : 'P';

      const longSym = buildOptionSymbol(s.ticker, s.expiration, optType, s.longStrike);
      const shortSym = buildOptionSymbol(s.ticker, s.expiration, optType, s.shortStrike);
      syms.add(longSym);
      syms.add(shortSym);

      map.set(longSym, {
        positionId: s.id,
        entryPrice: s.longPrice,
        contracts: s.contracts,
        direction: 'bought',
        leg: 'long',
      });
      map.set(shortSym, {
        positionId: s.id,
        entryPrice: s.shortPrice,
        contracts: s.contracts,
        direction: 'sold',
        leg: 'short',
      });

      pairs.set(s.id, {
        longSymbol: longSym,
        shortSymbol: shortSym,
        netEntry: s.netDebit / (s.contracts * 100), // per-contract net
        contracts: s.contracts,
      });
    }

    return { symbols: Array.from(syms), symbolMap: map, spreadPairs: pairs };
  }, [openTrades, openCalls, openDirectional, openSpreads]);

  const refreshInterval = symbols.length > 0 ? (isOpen ? 60000 : 300000) : 0;

  const { data, error, isLoading } = useSWR<{ quotes: OptionQuote[] }>(
    symbols.length > 0 ? `/api/option-quotes?symbols=${symbols.join(',')}` : null,
    { refreshInterval }
  );

  // Build positions map keyed by position ID
  const positions = useMemo(() => {
    const map = new Map<string, PositionQuoteData>();
    if (!data?.quotes) return map;

    const quoteMap = new Map<string, OptionQuote>();
    for (const q of data.quotes) {
      quoteMap.set(q.symbol, q);
    }

    // Process non-spread positions
    symbolMap.forEach((mapping, sym) => {
      if (mapping.leg) return; // spreads handled separately
      const q = quoteMap.get(sym);
      if (!q) return;

      const mid = q.midpoint;
      let unrealizedPL: number;

      if (mapping.direction === 'sold') {
        // Sold: profit when option price drops
        unrealizedPL = (mapping.entryPrice - mid) * 100 * mapping.contracts;
      } else {
        // Bought: profit when option price rises
        unrealizedPL = (mid - mapping.entryPrice) * 100 * mapping.contracts;
      }

      map.set(mapping.positionId, {
        unrealizedPL,
        delta: q.delta,
        gamma: q.gamma,
        theta: q.theta,
        vega: q.vega,
        iv: q.iv,
        midpoint: mid,
        bid: q.bid,
        ask: q.ask,
      });
    });

    // Process spread positions (combine both legs)
    spreadPairs.forEach((pair, posId) => {
      const longQ = quoteMap.get(pair.longSymbol);
      const shortQ = quoteMap.get(pair.shortSymbol);
      if (!longQ && !shortQ) return;

      const longMid = longQ?.midpoint ?? 0;
      const shortMid = shortQ?.midpoint ?? 0;
      const currentSpreadMid = longMid - shortMid; // net cost to close
      const unrealizedPL = (pair.netEntry - currentSpreadMid) * -100 * pair.contracts;

      const netDelta = ((longQ?.delta ?? 0) - (shortQ?.delta ?? 0)) || null;
      const netGamma = ((longQ?.gamma ?? 0) - (shortQ?.gamma ?? 0)) || null;
      const netTheta = ((longQ?.theta ?? 0) - (shortQ?.theta ?? 0)) || null;
      const netVega = ((longQ?.vega ?? 0) - (shortQ?.vega ?? 0)) || null;

      map.set(posId, {
        unrealizedPL,
        delta: netDelta,
        gamma: netGamma,
        theta: netTheta,
        vega: netVega,
        iv: longQ?.iv ?? shortQ?.iv ?? null,
        midpoint: longMid - shortMid,
        bid: 0,
        ask: 0,
      });
    });

    return map;
  }, [data, symbolMap, spreadPairs]);

  return {
    positions,
    isLoading,
    error: error?.message ?? null,
  };
}
