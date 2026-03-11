'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useTrades } from './useTrades';
import { useCoveredCalls } from './useCoveredCalls';
import { useSpreads } from './useSpreads';
import { useLocalStorage } from './useLocalStorage';
import { useMarketStatus } from './useMarketStatus';
import { StockPrice, PressurePosition, DEFAULT_PRESSURE_THRESHOLDS } from '@/types';
import { calculateDTE } from '@/lib/utils';

export function usePressure() {
  const { openTrades } = useTrades();
  const { openCalls } = useCoveredCalls();
  const { openSpreads } = useSpreads();

  const [thresholds, setThresholds] = useLocalStorage(
    'pressure-thresholds',
    DEFAULT_PRESSURE_THRESHOLDS
  );

  // Extract unique tickers from open positions
  const tickers = useMemo(() => {
    const set = new Set<string>();
    openTrades.forEach((t) => set.add(t.ticker));
    openCalls.forEach((c) => set.add(c.ticker));
    openSpreads
      .filter((s) => s.spreadType === 'put_credit' || s.spreadType === 'call_credit')
      .forEach((s) => set.add(s.ticker));
    return Array.from(set).sort();
  }, [openTrades, openCalls, openSpreads]);

  const { isOpen: marketOpen, label: marketStatusLabel } = useMarketStatus();
  const refreshInterval = tickers.length > 0 ? (marketOpen ? 60000 : 300000) : 0;

  const { data: priceData, error } = useSWR<{ prices: StockPrice[]; fetchedAt?: string }>(
    tickers.length > 0 ? `/api/stock-prices?tickers=${tickers.join(',')}` : null,
    { refreshInterval }
  );

  const stockPrices = useMemo(() => priceData?.prices ?? [], [priceData]);
  const priceMap = useMemo(() => {
    const map = new Map<string, StockPrice>();
    stockPrices.forEach((p) => map.set(p.ticker, p));
    return map;
  }, [stockPrices]);

  const pressurePositions = useMemo(() => {
    const positions: PressurePosition[] = [];

    // CSPs — pressure when stock drops toward strike
    for (const t of openTrades) {
      const sp = priceMap.get(t.ticker);
      if (!sp) continue;
      const pctOfStrike = (sp.price / t.strike) * 100;
      if (pctOfStrike > thresholds.csp) continue;

      const dte = calculateDTE(t.expiration);
      const itm = sp.price < t.strike;
      const within2 = pctOfStrike >= 98;
      const severity = getSeverity(itm, within2, dte);

      positions.push({
        id: t.id,
        ticker: t.ticker,
        tradeType: 'csp',
        strike: t.strike,
        currentPrice: sp.price,
        priceToStrikePercent: pctOfStrike,
        dte,
        expiration: t.expiration,
        contracts: t.contracts,
        severity,
        label: `$${t.strike}P x${t.contracts}`,
      });
    }

    // Covered Calls — pressure when stock rises toward strike
    for (const c of openCalls) {
      const sp = priceMap.get(c.ticker);
      if (!sp) continue;
      const pctOfStrike = (sp.price / c.strike) * 100;
      if (pctOfStrike < thresholds.cc) continue;

      const dte = calculateDTE(c.expiration);
      const itm = sp.price > c.strike;
      const within2 = pctOfStrike <= 102;
      const severity = getSeverity(itm, within2, dte);

      positions.push({
        id: c.id,
        ticker: c.ticker,
        tradeType: 'cc',
        strike: c.strike,
        currentPrice: sp.price,
        priceToStrikePercent: pctOfStrike,
        dte,
        expiration: c.expiration,
        contracts: c.contracts,
        severity,
        label: `$${c.strike}C x${c.contracts}`,
      });
    }

    // Credit Spreads — use short strike
    for (const s of openSpreads) {
      if (s.spreadType !== 'put_credit' && s.spreadType !== 'call_credit') continue;
      const sp = priceMap.get(s.ticker);
      if (!sp) continue;

      const strike = s.shortStrike;
      const pctOfStrike = (sp.price / strike) * 100;
      const isPutCredit = s.spreadType === 'put_credit';

      if (isPutCredit && pctOfStrike > thresholds.creditSpread) continue;
      if (!isPutCredit && pctOfStrike < (200 - thresholds.creditSpread)) continue;

      const dte = calculateDTE(s.expiration);
      const itm = isPutCredit ? sp.price < strike : sp.price > strike;
      const within2 = isPutCredit ? pctOfStrike >= 98 : pctOfStrike <= 102;
      const severity = getSeverity(itm, within2, dte);
      const strikeLabel = isPutCredit
        ? `$${s.shortStrike}/$${s.longStrike}P`
        : `$${s.longStrike}/$${s.shortStrike}C`;

      positions.push({
        id: s.id,
        ticker: s.ticker,
        tradeType: 'credit_spread',
        strike,
        currentPrice: sp.price,
        priceToStrikePercent: pctOfStrike,
        dte,
        expiration: s.expiration,
        contracts: s.contracts,
        severity,
        label: `${strikeLabel} x${s.contracts}`,
      });
    }

    // Sort by severity (critical first) then by proximity to strike
    const severityOrder = { critical: 0, danger: 1, warning: 2 };
    positions.sort((a, b) => {
      const sDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sDiff !== 0) return sDiff;
      return Math.abs(100 - a.priceToStrikePercent) - Math.abs(100 - b.priceToStrikePercent);
    });

    return positions;
  }, [openTrades, openCalls, openSpreads, priceMap, thresholds]);

  return {
    pressurePositions,
    stockPrices,
    thresholds,
    setThresholds,
    isLoading: tickers.length > 0 && !priceData && !error,
    isMarketOpen: marketOpen,
    marketStatusLabel,
    fetchedAt: priceData?.fetchedAt ?? null,
    error: error?.message ?? null,
  };
}

function getSeverity(
  itm: boolean,
  within2Pct: boolean,
  dte: number,
): 'warning' | 'danger' | 'critical' {
  if (itm) return 'critical';
  if (dte <= 7 && within2Pct) return 'critical';
  if (within2Pct || dte <= 3) return 'danger';
  return 'warning';
}
