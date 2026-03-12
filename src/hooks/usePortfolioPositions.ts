'use client';

import { useMemo } from 'react';
import { useTrades } from './useTrades';
import { useCoveredCalls } from './useCoveredCalls';
import { useDirectionalTrades } from './useDirectionalTrades';
import { useSpreads } from './useSpreads';
import { useStockEvents } from './useStockEvents';
import { useHoldings } from './useHoldings';
import { useOptionQuotes } from './useOptionQuotes';
import { useMarketStatus } from './useMarketStatus';
import { useTickerDetails } from './useTickerDetails';
import { useStockPrices } from './useStockPrices';
import { useFormatters } from './useFormatters';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, SPREAD_TYPE_LABELS } from '@/types';
import {
  formatCurrency as rawFormatCurrency,
  calculatePL,
  calculateCCPL,
  calculateDTE,
  calculateDirectionalPL,
  calculateSpreadPL,
  calculateReturnOnCollateral,
} from '@/lib/utils';

export interface OpenPosition {
  id: string;
  ticker: string;
  type: 'csp' | 'cc' | 'directional' | 'spread';
  label: string;
  badge: string;
  badgeColor: string;
  dte: number;
  expiration: string;
  contracts: number;
  detail: string;
  value: string;
  valueLabel: string;
  subDetail: string;
  canClose: boolean;
  trade: Trade | null;
  rawTrade?: Trade | CoveredCall | DirectionalTrade | SpreadTrade;
  unrealizedPL: number | null;
  dailyPL: number | null;
  maxPremium: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  companyName: string | null;
  stockPrice: number | null;
}

export interface RecentActivityItem {
  id: string;
  ticker: string;
  detail: string;
  exitDate: string;
  pl: number;
  type: 'csp' | 'cc' | 'directional' | 'spread' | 'stock';
  reason: string;
}

export interface UnrealizedByStrategy {
  csp: { unrealized: number; premiumCollected: number; count: number };
  cc: { unrealized: number; premiumCollected: number; count: number };
  directional: { unrealized: number; cost: number; count: number };
  spread: { unrealized: number; netDebit: number; count: number };
}

export interface StrategyPulse {
  key: string;
  label: string;
  icon: string;
  color: string;
  pl: number;
  open: number;
  closed: number;
}

export interface AllocationDatum {
  name: string;
  value: number;
  color: string;
}

export function usePortfolioPositions() {
  // ── Trade data hooks ──
  const tradesHook = useTrades();
  const ccHook = useCoveredCalls();
  const dirHook = useDirectionalTrades();
  const spreadsHook = useSpreads();
  const stockEventsHook = useStockEvents();
  const holdingsHook = useHoldings();

  // Destructure what we need for aggregation
  const {
    trades: allCSPTrades, openTrades, closedTrades,
    accountSettings, totalCollateral, heat,
    addTrade, closeTrade, rollTrade,
    isLoading: tradesLoading, error: tradesError, retry: tradesRetry,
  } = tradesHook;

  const {
    openCalls, closedCalls, calls: allCCTrades, addCall,
    isLoading: ccLoading, error: ccError, retry: ccRetry,
  } = ccHook;

  const {
    openTrades: openDirectional, closedTrades: closedDirectional, trades: allDirectional,
    addTrade: addDirectional,
    isLoading: dirLoading, error: dirError, retry: dirRetry,
  } = dirHook;

  const {
    openSpreads, closedSpreads, spreads: allSpreads, addSpread,
    isLoading: spreadsLoading, error: spreadsError, retry: spreadsRetry,
  } = spreadsHook;

  const {
    stockEvents, totalStockPL,
    isLoading: stockLoading, error: stockError, retry: stockRetry,
  } = stockEventsHook;

  const {
    holdings,
    isLoading: holdingsLoading, error: holdingsError, retry: holdingsRetry,
  } = holdingsHook;

  // ── Market data hooks ──
  const { positions: optionPositions, fetchedAt: greeksFetchedAt } = useOptionQuotes();
  useMarketStatus(); // triggers SWR caching for child components

  const allTickers = useMemo(() => {
    const set = new Set<string>();
    openTrades.forEach(t => set.add(t.ticker));
    openCalls.forEach(c => set.add(c.ticker));
    openDirectional.forEach(t => set.add(t.ticker));
    openSpreads.forEach(s => set.add(s.ticker));
    holdings.forEach(h => set.add(h.ticker.toUpperCase()));
    return Array.from(set);
  }, [openTrades, openCalls, openDirectional, openSpreads, holdings]);

  const { nameMap: tickerNames } = useTickerDetails(allTickers);
  const { prices: stockPrices } = useStockPrices(allTickers);

  // ── Loading / error ──
  const isLoading = tradesLoading || ccLoading || dirLoading || spreadsLoading || stockLoading || holdingsLoading;
  const firstError = tradesError || ccError || dirError || spreadsError || stockError || holdingsError;
  const retryAll = () => {
    tradesRetry(); ccRetry(); dirRetry(); spreadsRetry(); stockRetry(); holdingsRetry();
  };

  // ── Formatters ──
  const { formatCurrency, privacyMode } = useFormatters();

  // ── P/L calculations ──
  const cspPL = closedTrades.reduce((sum, t) => sum + calculatePL(t), 0);
  const ccPL = closedCalls.reduce((sum, c) => sum + calculateCCPL(c), 0);
  const directionalPL = closedDirectional.reduce((sum, t) => sum + calculateDirectionalPL(t), 0);
  const spreadsPL = closedSpreads.reduce((sum, t) => sum + calculateSpreadPL(t), 0);
  const optionsPL = cspPL + ccPL + directionalPL + spreadsPL;
  const totalPL = optionsPL + totalStockPL;

  const totalClosedCount = closedTrades.length + closedCalls.length + closedDirectional.length + closedSpreads.length;
  const totalWinning = closedTrades.filter(t => calculatePL(t) > 0).length
    + closedCalls.filter(c => calculateCCPL(c) > 0).length
    + closedDirectional.filter(t => calculateDirectionalPL(t) > 0).length
    + closedSpreads.filter(t => calculateSpreadPL(t) > 0).length;
  const overallWinRate = totalClosedCount > 0 ? (totalWinning / totalClosedCount) * 100 : 0;

  const directionalCapitalDeployed = openDirectional.reduce((sum, t) => sum + t.costAtOpen, 0);
  const spreadsCapitalAtRisk = openSpreads.reduce((sum, t) => sum + t.maxLoss, 0);

  // ── Capital allocation ──
  const allocationData: AllocationDatum[] = [
    { name: 'CSP Collateral', value: totalCollateral, color: '#10b981' },
    { name: 'CC Shares', value: openCalls.reduce((sum, c) => sum + c.costBasis, 0), color: '#3b82f6' },
    { name: 'Directional', value: directionalCapitalDeployed, color: '#f59e0b' },
    { name: 'Spreads', value: spreadsCapitalAtRisk, color: '#a855f7' },
  ].filter((d) => d.value > 0);

  // ── Unified open positions ──
  const allOpenPositions: OpenPosition[] = useMemo(() => [
    ...openTrades.map((t) => {
      const oq = optionPositions.get(t.id);
      return {
        id: t.id,
        ticker: t.ticker,
        type: 'csp' as const,
        label: `$${t.strike}P`,
        badge: 'CSP',
        badgeColor: 'bg-emerald-500/10 text-emerald-400',
        dte: calculateDTE(t.expiration),
        expiration: t.expiration,
        contracts: t.contracts,
        detail: `x${t.contracts}`,
        value: formatCurrency(t.premiumCollected),
        valueLabel: 'premium',
        subDetail: privacyMode ? '**% ROC' : `${calculateReturnOnCollateral(t).toFixed(1)}% ROC`,
        canClose: true,
        trade: t,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        dailyPL: oq?.dailyPL ?? null,
        maxPremium: t.premiumCollected,
        delta: oq?.delta ?? null,
        gamma: oq?.gamma ?? null,
        theta: oq?.theta ?? null,
        vega: oq?.vega ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
        stockPrice: stockPrices.get(t.ticker)?.price ?? null,
      };
    }),
    ...openCalls.map((c) => {
      const oq = optionPositions.get(c.id);
      return {
        id: c.id,
        ticker: c.ticker,
        type: 'cc' as const,
        label: `$${c.strike}C`,
        badge: 'CC',
        badgeColor: 'bg-blue-500/10 text-blue-400',
        dte: calculateDTE(c.expiration),
        expiration: c.expiration,
        contracts: c.contracts,
        detail: `x${c.contracts}`,
        value: formatCurrency(c.premiumCollected),
        valueLabel: 'premium',
        subDetail: privacyMode ? '*** shares' : `${c.sharesHeld} shares`,
        canClose: false,
        trade: null,
        rawTrade: c,
        unrealizedPL: oq?.unrealizedPL ?? null,
        dailyPL: oq?.dailyPL ?? null,
        maxPremium: c.premiumCollected,
        delta: oq?.delta ?? null,
        gamma: oq?.gamma ?? null,
        theta: oq?.theta ?? null,
        vega: oq?.vega ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(c.ticker) ?? null,
        stockPrice: stockPrices.get(c.ticker)?.price ?? null,
      };
    }),
    ...openDirectional.map((t) => {
      const oq = optionPositions.get(t.id);
      return {
        id: t.id,
        ticker: t.ticker,
        type: 'directional' as const,
        label: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'}`,
        badge: t.optionType === 'call' ? 'CALL' : 'PUT',
        badgeColor: t.optionType === 'call' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
        dte: calculateDTE(t.expiration),
        expiration: t.expiration,
        contracts: t.contracts,
        detail: `x${t.contracts}`,
        value: formatCurrency(t.costAtOpen),
        valueLabel: 'cost',
        subDetail: '',
        canClose: false,
        trade: null,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        dailyPL: oq?.dailyPL ?? null,
        maxPremium: t.costAtOpen,
        delta: oq?.delta ?? null,
        gamma: oq?.gamma ?? null,
        theta: oq?.theta ?? null,
        vega: oq?.vega ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
        stockPrice: stockPrices.get(t.ticker)?.price ?? null,
      };
    }),
    ...openSpreads.map((t) => {
      const oq = optionPositions.get(t.id);
      return {
        id: t.id,
        ticker: t.ticker,
        type: 'spread' as const,
        label: `$${t.longStrike}/$${t.shortStrike}`,
        badge: SPREAD_TYPE_LABELS[t.spreadType],
        badgeColor: 'bg-purple-500/10 text-purple-400',
        dte: calculateDTE(t.expiration),
        expiration: t.expiration,
        contracts: t.contracts,
        detail: `x${t.contracts}`,
        value: privacyMode ? '$***' : (t.netDebit < 0 ? `CR ${rawFormatCurrency(Math.abs(t.netDebit))}` : rawFormatCurrency(t.netDebit)),
        valueLabel: t.netDebit < 0 ? 'credit' : 'debit',
        subDetail: privacyMode ? 'Max loss: $***' : `Max loss: ${formatCurrency(t.maxLoss)}`,
        canClose: false,
        trade: null,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        dailyPL: oq?.dailyPL ?? null,
        maxPremium: t.netDebit < 0 ? Math.abs(t.netDebit) : t.maxProfit,
        delta: oq?.delta ?? null,
        gamma: oq?.gamma ?? null,
        theta: oq?.theta ?? null,
        vega: oq?.vega ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
        stockPrice: stockPrices.get(t.ticker)?.price ?? null,
      };
    }),
  ].sort((a, b) => a.dte - b.dte), [
    openTrades, openCalls, openDirectional, openSpreads,
    optionPositions, tickerNames, stockPrices,
    formatCurrency, privacyMode,
  ]);

  // ── Unrealized P/L ──
  const totalUnrealizedPL = allOpenPositions.reduce(
    (sum, p) => sum + (p.unrealizedPL ?? 0), 0
  );
  const hasUnrealizedData = allOpenPositions.some(p => p.unrealizedPL !== null);

  const unrealizedByStrategy: UnrealizedByStrategy = useMemo(() => {
    const result: UnrealizedByStrategy = {
      csp: { unrealized: 0, premiumCollected: 0, count: 0 },
      cc: { unrealized: 0, premiumCollected: 0, count: 0 },
      directional: { unrealized: 0, cost: 0, count: 0 },
      spread: { unrealized: 0, netDebit: 0, count: 0 },
    };
    for (const p of allOpenPositions) {
      if (p.unrealizedPL == null) continue;
      const s = result[p.type];
      s.unrealized += p.unrealizedPL;
      s.count += 1;
    }
    for (const t of openTrades) result.csp.premiumCollected += t.premiumCollected;
    for (const c of openCalls) result.cc.premiumCollected += c.premiumCollected;
    for (const t of openDirectional) result.directional.cost += t.costAtOpen;
    for (const s of openSpreads) result.spread.netDebit += s.netDebit;
    return result;
  }, [allOpenPositions, openTrades, openCalls, openDirectional, openSpreads]);

  // ── Daily P/L ──
  const holdingsDailyPL = holdings.reduce((sum, h) => {
    const sp = stockPrices.get(h.ticker.toUpperCase());
    return sum + (sp ? h.shares * sp.change : 0);
  }, 0);

  const optionsDailyPL = allOpenPositions.reduce(
    (sum, p) => sum + (p.dailyPL ?? 0), 0
  );
  const totalDailyPL = holdingsDailyPL + optionsDailyPL;

  // ── Recent activity ──
  const recentActivity: RecentActivityItem[] = useMemo(() => [
    ...closedTrades.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      detail: `$${t.strike}P x${t.contracts}`,
      exitDate: t.exitDate || '',
      pl: calculatePL(t),
      type: 'csp' as const,
      reason: t.exitReason || '',
    })),
    ...closedCalls.map((c) => ({
      id: c.id,
      ticker: c.ticker,
      detail: `$${c.strike}C x${c.contracts}`,
      exitDate: c.exitDate || '',
      pl: calculateCCPL(c),
      type: 'cc' as const,
      reason: c.status || '',
    })),
    ...closedDirectional.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      detail: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'} x${t.contracts}`,
      exitDate: t.exitDate || '',
      pl: calculateDirectionalPL(t),
      type: 'directional' as const,
      reason: '',
    })),
    ...closedSpreads.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      detail: `$${t.longStrike}/$${t.shortStrike} x${t.contracts}`,
      exitDate: t.exitDate || '',
      pl: calculateSpreadPL(t),
      type: 'spread' as const,
      reason: '',
    })),
    ...stockEvents.map((e) => ({
      id: e.id,
      ticker: e.ticker,
      detail: privacyMode ? `*** shares @ $***` : `${e.shares} shares @ $${e.salePrice.toFixed(2)}`,
      exitDate: e.saleDate,
      pl: e.realizedPL,
      type: 'stock' as const,
      reason: e.isTaxLossHarvest ? 'TLH' : '',
    })),
  ]
    .sort((a, b) => b.exitDate.localeCompare(a.exitDate))
    .slice(0, 8), [closedTrades, closedCalls, closedDirectional, closedSpreads, stockEvents, privacyMode]);

  // ── Strategy pulse ──
  const strategies: StrategyPulse[] = [
    { key: 'csp', label: 'CSPs', icon: 'P', color: 'emerald', pl: cspPL, open: openTrades.length, closed: closedTrades.length },
    { key: 'cc', label: 'Covered Calls', icon: 'C', color: 'blue', pl: ccPL, open: openCalls.length, closed: closedCalls.length },
    ...(allDirectional.length > 0 ? [{ key: 'dir', label: 'Directional', icon: 'D', color: 'amber', pl: directionalPL, open: openDirectional.length, closed: closedDirectional.length }] : []),
    ...(allSpreads.length > 0 ? [{ key: 'spread', label: 'Spreads', icon: 'S', color: 'purple', pl: spreadsPL, open: openSpreads.length, closed: closedSpreads.length }] : []),
    ...(stockEvents.length > 0 ? [{ key: 'stock', label: 'Stock / TLH', icon: '$', color: 'pink', pl: totalStockPL, open: 0, closed: stockEvents.length }] : []),
  ];

  return {
    // ── Aggregated data ──
    allOpenPositions,
    recentActivity,
    allocationData,
    strategies,
    unrealizedByStrategy,

    // ── P/L summaries ──
    cspPL,
    ccPL,
    directionalPL,
    spreadsPL,
    optionsPL,
    totalPL,
    totalStockPL,
    totalUnrealizedPL,
    hasUnrealizedData,
    totalDailyPL,
    holdingsDailyPL,
    optionsDailyPL,
    totalClosedCount,
    totalWinning,
    overallWinRate,

    // ── Capital ──
    totalCollateral,
    heat,
    accountSettings,
    directionalCapitalDeployed,
    spreadsCapitalAtRisk,

    // ── Market data ──
    greeksFetchedAt,
    tickerNames,
    stockPrices,

    // ── Loading / error ──
    isLoading,
    firstError,
    retryAll,

    // ── Formatters ──
    formatCurrency,
    privacyMode,

    // ── Raw collections (for CommandPalette, tooltips, etc.) ──
    allCSPTrades,
    openTrades,
    closedTrades,
    allCCTrades,
    openCalls,
    closedCalls,
    allDirectional,
    openDirectional,
    closedDirectional,
    allSpreads,
    openSpreads,
    closedSpreads,
    stockEvents,
    holdings,

    // ── Mutation functions ──
    addTrade,
    closeTrade,
    rollTrade,
    addCall,
    addDirectional,
    addSpread,
  };
}
