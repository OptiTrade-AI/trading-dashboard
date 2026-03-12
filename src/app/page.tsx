'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTrades } from '@/hooks/useTrades';
import { useCoveredCalls, calculateCCPL } from '@/hooks/useCoveredCalls';
import { useDirectionalTrades } from '@/hooks/useDirectionalTrades';
import { useSpreads } from '@/hooks/useSpreads';
import { useStockEvents } from '@/hooks/useStockEvents';
import { useOptionQuotes } from '@/hooks/useOptionQuotes';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { useTickerDetails } from '@/hooks/useTickerDetails';
import { useHoldings } from '@/hooks/useHoldings';
import { PressureCard } from '@/components/PressureCard';
import { CloseTradeModal } from '@/components/TradeModal';
import { SkeletonDashboard } from '@/components/SkeletonLoader';
import { PositionsTimeline } from '@/components/dashboard/PositionsTimeline';
import { CapitalAllocationCard } from '@/components/dashboard/CapitalAllocationCard';
import { PortfolioGreeksCard } from '@/components/dashboard/PortfolioGreeksCard';
import { CompactHeat } from '@/components/dashboard/CompactHeat';
import { UncoveredHoldingsCard } from '@/components/dashboard/UncoveredHoldingsCard';
import { ExpirationAlertBanner } from '@/components/dashboard/ExpirationAlertBanner';
import { SmartAlertsBadge } from '@/components/dashboard/SmartAlertsBadge';
import { EarningsWatchCard } from '@/components/dashboard/EarningsWatchCard';
import { ThetaDashboardCard } from '@/components/dashboard/ThetaDashboardCard';
import { DailySummaryLine } from '@/components/dashboard/DailySummaryLine';
import { QuickAddFAB } from '@/components/QuickAddFAB';
import { AddTradeModal } from '@/components/TradeModal';
import { AddCCModal } from '@/components/CCModal';
import { AddDirectionalModal } from '@/components/DirectionalModal';
import { AddSpreadModal } from '@/components/SpreadsModal';
import { CommandPalette } from '@/components/CommandPalette';
import { useStockPrices } from '@/hooks/useStockPrices';
import { ImportModal } from '@/components/ImportModal';
import { Trade, ExitReason, SPREAD_TYPE_LABELS } from '@/types';
import {
  formatCurrency as rawFormatCurrency,
  formatDateShort,
  calculatePL,
  calculateDTE,
  calculateDirectionalPL,
  calculateSpreadPL,
  calculateReturnOnCollateral,
  cn,
} from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

export default function Dashboard() {
  const {
    trades: allCSPTrades,
    openTrades,
    closedTrades,
    accountSettings,
    totalCollateral,
    heat,
    addTrade,
    closeTrade,
    rollTrade,
    isLoading: tradesLoading,
  } = useTrades();

  const { openCalls, closedCalls, calls: allCCTrades, addCall, isLoading: ccLoading } = useCoveredCalls();

  const {
    openTrades: openDirectional,
    closedTrades: closedDirectional,
    trades: allDirectional,
    addTrade: addDirectional,
    isLoading: dirLoading,
  } = useDirectionalTrades();

  const {
    openSpreads,
    closedSpreads,
    spreads: allSpreads,
    addSpread,
    isLoading: spreadsLoading,
  } = useSpreads();

  const {
    stockEvents,
    totalStockPL,
    isLoading: stockLoading,
  } = useStockEvents();

  const { holdings, isLoading: holdingsLoading } = useHoldings();

  const { positions: optionPositions, fetchedAt: greeksFetchedAt } = useOptionQuotes();
  useMarketStatus(); // triggers SWR caching for child components

  // Collect all unique tickers for company name lookup + stock prices
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

  const isLoading = tradesLoading || ccLoading || dirLoading || spreadsLoading || stockLoading || holdingsLoading;

  const [closeModalTrade, setCloseModalTrade] = useState<Trade | null>(null);
  const [quickAddType, setQuickAddType] = useState<'csp' | 'cc' | 'directional' | 'spread' | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleCloseTrade = (exitPrice: number, exitDate: string, exitReason: ExitReason) => {
    if (closeModalTrade) {
      closeTrade(closeModalTrade.id, exitPrice, exitDate, exitReason);
      setCloseModalTrade(null);
    }
  };

  const handleRollTrade = (exitPrice: number, exitDate: string, newTrade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>) => {
    if (closeModalTrade) {
      rollTrade(closeModalTrade.id, exitPrice, exitDate, newTrade);
      setCloseModalTrade(null);
    }
  };

  const { formatCurrency, privacyMode } = useFormatters();

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  // P/L calculations
  const cspPL = closedTrades.reduce((sum, t) => sum + calculatePL(t), 0);
  const ccPL = closedCalls.reduce((sum, c) => sum + calculateCCPL(c), 0);
  const directionalPL = closedDirectional.reduce((sum, t) => sum + calculateDirectionalPL(t), 0);
  const spreadsPL = closedSpreads.reduce((sum, t) => sum + calculateSpreadPL(t), 0);
  const optionsPL = cspPL + ccPL + directionalPL + spreadsPL;
  const totalPL = optionsPL + totalStockPL;

  const allClosed = [...closedTrades.map(t => ({ ...t, _type: 'csp' as const })),
    ...closedCalls.map(c => ({ ...c, _type: 'cc' as const })),
    ...closedDirectional.map(t => ({ ...t, _type: 'dir' as const })),
    ...closedSpreads.map(t => ({ ...t, _type: 'spread' as const }))];
  const totalClosedCount = allClosed.length;
  const totalWinning = closedTrades.filter(t => calculatePL(t) > 0).length
    + closedCalls.filter(c => calculateCCPL(c) > 0).length
    + closedDirectional.filter(t => calculateDirectionalPL(t) > 0).length
    + closedSpreads.filter(t => calculateSpreadPL(t) > 0).length;
  const overallWinRate = totalClosedCount > 0 ? (totalWinning / totalClosedCount) * 100 : 0;

  const directionalCapitalDeployed = openDirectional.reduce((sum, t) => sum + t.costAtOpen, 0);
  const spreadsCapitalAtRisk = openSpreads.reduce((sum, t) => sum + t.maxLoss, 0);

  // Capital allocation data
  const allocationData = [
    { name: 'CSP Collateral', value: totalCollateral, color: '#10b981' },
    { name: 'CC Shares', value: openCalls.reduce((sum, c) => sum + c.costBasis, 0), color: '#3b82f6' },
    { name: 'Directional', value: directionalCapitalDeployed, color: '#f59e0b' },
    { name: 'Spreads', value: spreadsCapitalAtRisk, color: '#a855f7' },
  ].filter((d) => d.value > 0);

  // Unified open positions
  const allOpenPositions = [
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
  ].sort((a, b) => a.dte - b.dte);

  // Total unrealized P/L across all open positions
  const totalUnrealizedPL = allOpenPositions.reduce(
    (sum, p) => sum + (p.unrealizedPL ?? 0), 0
  );
  const hasUnrealizedData = allOpenPositions.some(p => p.unrealizedPL !== null);

  // Unrealized breakdown by strategy
  const unrealizedByStrategy = {
    csp: { unrealized: 0, premiumCollected: 0, count: 0 },
    cc: { unrealized: 0, premiumCollected: 0, count: 0 },
    directional: { unrealized: 0, cost: 0, count: 0 },
    spread: { unrealized: 0, netDebit: 0, count: 0 },
  };
  for (const p of allOpenPositions) {
    if (p.unrealizedPL == null) continue;
    const s = unrealizedByStrategy[p.type];
    s.unrealized += p.unrealizedPL;
    s.count += 1;
  }
  for (const t of openTrades) unrealizedByStrategy.csp.premiumCollected += t.premiumCollected;
  for (const c of openCalls) unrealizedByStrategy.cc.premiumCollected += c.premiumCollected;
  for (const t of openDirectional) unrealizedByStrategy.directional.cost += t.costAtOpen;
  for (const s of openSpreads) unrealizedByStrategy.spread.netDebit += s.netDebit;

  // Daily P/L from holdings price changes
  const holdingsDailyPL = holdings.reduce((sum, h) => {
    const sp = stockPrices.get(h.ticker.toUpperCase());
    return sum + (sp ? h.shares * sp.change : 0);
  }, 0);

  // Daily P/L from options positions (session change from Polygon)
  const optionsDailyPL = allOpenPositions.reduce(
    (sum, p) => sum + (p.dailyPL ?? 0), 0
  );
  const totalDailyPL = holdingsDailyPL + optionsDailyPL;

  // Recent activity — all trade types
  const recentActivity = [
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
    .slice(0, 8);

  // Strategy pulse data
  const strategies = [
    { key: 'csp', label: 'CSPs', icon: 'P', color: 'emerald', pl: cspPL, open: openTrades.length, closed: closedTrades.length },
    { key: 'cc', label: 'Covered Calls', icon: 'C', color: 'blue', pl: ccPL, open: openCalls.length, closed: closedCalls.length },
    ...(allDirectional.length > 0 ? [{ key: 'dir', label: 'Directional', icon: 'D', color: 'amber', pl: directionalPL, open: openDirectional.length, closed: closedDirectional.length }] : []),
    ...(allSpreads.length > 0 ? [{ key: 'spread', label: 'Spreads', icon: 'S', color: 'purple', pl: spreadsPL, open: openSpreads.length, closed: closedSpreads.length }] : []),
    ...(stockEvents.length > 0 ? [{ key: 'stock', label: 'Stock / TLH', icon: '$', color: 'pink', pl: totalStockPL, open: 0, closed: stockEvents.length }] : []),
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    emerald: { bg: 'bg-emerald-500/5', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    blue: { bg: 'bg-blue-500/5', text: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    amber: { bg: 'bg-amber-500/5', text: 'text-amber-400', iconBg: 'bg-amber-500/10' },
    purple: { bg: 'bg-purple-500/5', text: 'text-purple-400', iconBg: 'bg-purple-500/10' },
    pink: { bg: 'bg-pink-500/5', text: 'text-pink-400', iconBg: 'bg-pink-500/10' },
  };

  return (
    <div className="space-y-6">
      {/* ── Expiration Alert ── */}
      <ExpirationAlertBanner positions={allOpenPositions} />

      {/* ── Smart Alerts + Earnings Watch ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SmartAlertsBadge />
        <EarningsWatchCard />
      </div>

      {/* ── Hero Banner ── */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Daily P/L */}
          <div className="flex-1 relative group/daily">
            <div className="stat-label mb-1 flex items-center gap-1.5">
              Daily P/L
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <div className={cn('text-3xl font-bold', totalDailyPL >= 0 ? 'text-profit' : 'text-loss')}>
              {totalDailyPL >= 0 ? '+' : ''}{formatCurrency(totalDailyPL)}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn('text-xs font-medium', holdingsDailyPL >= 0 ? 'text-profit' : 'text-loss')}>
                Stocks {holdingsDailyPL >= 0 ? '+' : ''}{formatCurrency(holdingsDailyPL)}
              </span>
              <span className={cn('text-xs font-medium', optionsDailyPL >= 0 ? 'text-profit' : 'text-loss')}>
                Options {optionsDailyPL >= 0 ? '+' : ''}{formatCurrency(optionsDailyPL)}
              </span>
            </div>
            {/* Per-position breakdown tooltip */}
            <div className="absolute bottom-full left-0 mb-2 w-72 glass-card p-3 rounded-xl border border-border/40 opacity-0 pointer-events-none group-hover/daily:opacity-100 group-hover/daily:pointer-events-auto transition-opacity z-[100] shadow-xl">
              <div className="text-xs font-semibold text-foreground mb-2">Today&apos;s Breakdown</div>
              <div className="space-y-1.5 text-xs">
                {holdings.length > 0 && (
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-wide">Holdings</div>
                )}
                {holdings
                  .map(h => {
                    const sp = stockPrices.get(h.ticker.toUpperCase());
                    const pl = sp ? h.shares * sp.change : 0;
                    const pct = sp ? sp.changePercent : 0;
                    return { ticker: h.ticker, pl, pct, has: !!sp };
                  })
                  .sort((a, b) => b.pl - a.pl)
                  .map(h => (
                    <div key={`h-${h.ticker}`} className="flex justify-between">
                      <span className="text-muted">{h.ticker}</span>
                      <span className={cn('font-semibold', h.pl >= 0 ? 'text-profit' : 'text-loss')}>
                        {h.has ? `${h.pl >= 0 ? '+' : ''}${rawFormatCurrency(h.pl)} (${h.pct >= 0 ? '+' : ''}${h.pct.toFixed(1)}%)` : 'No data'}
                      </span>
                    </div>
                  ))}
                {allOpenPositions.some(p => p.dailyPL != null) && (
                  <>
                    <div className="text-[10px] font-semibold text-muted uppercase tracking-wide mt-2">Options</div>
                    {allOpenPositions
                      .filter(p => p.dailyPL != null)
                      .sort((a, b) => (b.dailyPL ?? 0) - (a.dailyPL ?? 0))
                      .map(p => (
                        <div key={p.id} className="flex justify-between">
                          <span className="text-muted">{p.ticker} {p.label}</span>
                          <span className={cn('font-semibold', (p.dailyPL ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                            {(p.dailyPL ?? 0) >= 0 ? '+' : ''}{rawFormatCurrency(p.dailyPL ?? 0)}
                          </span>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-16 bg-border/30" />

          {/* Realized P/L */}
          <div className="flex-1">
            <div className="stat-label mb-1">Realized P/L</div>
            <div className={cn('text-3xl font-bold', totalPL >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn('text-xs font-medium', optionsPL >= 0 ? 'text-profit' : 'text-loss')}>
                Options {optionsPL >= 0 ? '+' : ''}{formatCurrency(optionsPL)}
              </span>
              {stockEvents.length > 0 && (
                <span className={cn('text-xs font-medium', totalStockPL >= 0 ? 'text-profit' : 'text-loss')}>
                  Stock {totalStockPL >= 0 ? '+' : ''}{formatCurrency(totalStockPL)}
                </span>
              )}
            </div>
          </div>

          {/* Unrealized P/L — own column */}
          {hasUnrealizedData && (
            <>
              <div className="hidden lg:block w-px h-16 bg-border/30" />
              <div className="relative group/unreal">
                <div className="stat-label mb-1">Unrealized</div>
                <div className={cn('text-2xl font-bold', totalUnrealizedPL >= 0 ? 'text-profit' : 'text-loss')}>
                  {totalUnrealizedPL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPL)}
                </div>
                <div className="text-xs text-muted mt-1">
                  {allOpenPositions.filter(p => p.unrealizedPL !== null).length} positions live
                  {greeksFetchedAt && (
                    <span className="ml-1.5" title={`Data fetched: ${greeksFetchedAt}`}>
                      · {new Date(greeksFetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {/* Breakdown tooltip */}
                <div className="absolute bottom-full left-0 mb-2 w-64 glass-card p-3 rounded-xl border border-border/40 opacity-0 pointer-events-none group-hover/unreal:opacity-100 group-hover/unreal:pointer-events-auto transition-opacity z-[100] shadow-xl">
                  <div className="text-xs font-semibold text-foreground mb-2">Unrealized Breakdown</div>
                  <div className="space-y-1.5 text-xs">
                    {unrealizedByStrategy.csp.count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted">CSP ({unrealizedByStrategy.csp.count})</span>
                        <div className="text-right">
                          <span className={cn('font-semibold', unrealizedByStrategy.csp.unrealized >= 0 ? 'text-profit' : 'text-loss')}>
                            {unrealizedByStrategy.csp.unrealized >= 0 ? '+' : ''}{rawFormatCurrency(unrealizedByStrategy.csp.unrealized)}
                          </span>
                          <span className="text-muted ml-1">/ {rawFormatCurrency(unrealizedByStrategy.csp.premiumCollected)}</span>
                        </div>
                      </div>
                    )}
                    {unrealizedByStrategy.cc.count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted">CC ({unrealizedByStrategy.cc.count})</span>
                        <div className="text-right">
                          <span className={cn('font-semibold', unrealizedByStrategy.cc.unrealized >= 0 ? 'text-profit' : 'text-loss')}>
                            {unrealizedByStrategy.cc.unrealized >= 0 ? '+' : ''}{rawFormatCurrency(unrealizedByStrategy.cc.unrealized)}
                          </span>
                          <span className="text-muted ml-1">/ {rawFormatCurrency(unrealizedByStrategy.cc.premiumCollected)}</span>
                        </div>
                      </div>
                    )}
                    {unrealizedByStrategy.directional.count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted">Directional ({unrealizedByStrategy.directional.count})</span>
                        <div className="text-right">
                          <span className={cn('font-semibold', unrealizedByStrategy.directional.unrealized >= 0 ? 'text-profit' : 'text-loss')}>
                            {unrealizedByStrategy.directional.unrealized >= 0 ? '+' : ''}{rawFormatCurrency(unrealizedByStrategy.directional.unrealized)}
                          </span>
                          <span className="text-muted ml-1">/ {rawFormatCurrency(unrealizedByStrategy.directional.cost)}</span>
                        </div>
                      </div>
                    )}
                    {unrealizedByStrategy.spread.count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted">Spreads ({unrealizedByStrategy.spread.count})</span>
                        <div className="text-right">
                          <span className={cn('font-semibold', unrealizedByStrategy.spread.unrealized >= 0 ? 'text-profit' : 'text-loss')}>
                            {unrealizedByStrategy.spread.unrealized >= 0 ? '+' : ''}{rawFormatCurrency(unrealizedByStrategy.spread.unrealized)}
                          </span>
                          <span className="text-muted ml-1">/ {rawFormatCurrency(Math.abs(unrealizedByStrategy.spread.netDebit))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border/30 mt-2 pt-2 text-[10px] text-muted">
                    Unrealized / max premium or cost at risk
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="hidden lg:block w-px h-16 bg-border/30" />

          {/* Win Rate */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(63,63,70,0.25)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="40" fill="none" stroke="#10b981"
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(overallWinRate / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.3))' }}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-foreground">
                  {totalClosedCount > 0 ? (privacyMode ? '**%' : `${overallWinRate.toFixed(0)}%`) : '-'}
                </span>
              </div>
            </div>
            <div>
              <div className="stat-label mb-0.5">Win Rate</div>
              <div className="text-sm text-muted">{privacyMode ? '***' : `${totalWinning}/${totalClosedCount}`}</div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-16 bg-border/30" />

          {/* Compact Heat */}
          <div className="lg:w-48">
            <CompactHeat heat={heat} maxHeatPercent={accountSettings.maxHeatPercent} privacyMode={privacyMode} />
          </div>
        </div>
      </div>

      {/* ── AI Daily Summary ── */}
      <DailySummaryLine />

      {/* ── Strategy Pulse ── */}
      <div className={cn('grid gap-4', strategies.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
        {strategies.map((s) => {
          const c = colorMap[s.color];
          return (
            <div key={s.key} className="glass-card p-4 flex items-center gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', c.iconBg)}>
                <span className={cn('font-bold text-sm', c.text)}>{s.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <span className={cn('text-sm font-bold', s.pl >= 0 ? 'text-profit' : 'text-loss')}>
                    {s.pl >= 0 ? '+' : ''}{formatCurrency(s.pl)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {s.open > 0 && <span className="text-xs text-muted">{s.open} open</span>}
                  <span className="text-xs text-muted">{s.closed} closed</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Portfolio Greeks ── */}
      {hasUnrealizedData && (
        <PortfolioGreeksCard positions={allOpenPositions} privacyMode={privacyMode} fetchedAt={greeksFetchedAt} />
      )}

      {/* ── Theta Income ── */}
      {hasUnrealizedData && (
        <ThetaDashboardCard positions={allOpenPositions} fetchedAt={greeksFetchedAt} />
      )}

      {/* ── Positions Under Pressure ── */}
      <PressureCard openPositions={allOpenPositions} />

      {/* ── Uncovered Holdings ── */}
      {holdings.length > 0 && (
        <UncoveredHoldingsCard
          holdings={holdings}
          openCalls={openCalls}
          privacyMode={privacyMode}
          tickerNames={tickerNames}
          stockPrices={stockPrices}
        />
      )}

      {/* ── Open Positions ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Open Positions</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">Import</button>
            <Link href="/log" className="btn-primary text-sm">+ New Trade</Link>
          </div>
        </div>

        {allOpenPositions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-foreground font-medium mb-2">No open positions</h3>
            <p className="text-muted text-sm mb-4">Add a trade to start tracking</p>
            <Link href="/log" className="btn-primary inline-block">Add Your First Trade</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Positions Timeline — full width hero */}
            <div className="glass-card p-5">
              <PositionsTimeline
                positions={allOpenPositions}
                onCloseTrade={(trade) => setCloseModalTrade(trade)}
              />
            </div>

            {/* Capital Allocation — full width below */}
            {allocationData.length > 0 && (
              <CapitalAllocationCard
                data={allocationData}
                accountValue={accountSettings.accountValue}
                privacyMode={privacyMode}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Recent Activity ── */}
      {recentActivity.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
            <Link href="/log" className="text-accent text-sm hover:text-accent-light transition-colors">
              View all →
            </Link>
          </div>
          <div className="glass-card divide-y divide-border/30">
            {recentActivity.map((trade) => (
              <div key={`${trade.type}-${trade.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/30 transition-colors">
                <div className={cn(
                  'w-1.5 h-8 rounded-full flex-shrink-0',
                  trade.pl >= 0 ? 'bg-profit/60' : 'bg-loss/60'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{trade.ticker}</span>
                    <span className="text-muted text-sm">{trade.detail}</span>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                      trade.type === 'csp' ? 'bg-emerald-500/10 text-emerald-400' :
                      trade.type === 'cc' ? 'bg-blue-500/10 text-blue-400' :
                      trade.type === 'directional' ? 'bg-amber-500/10 text-amber-400' :
                      trade.type === 'stock' ? 'bg-pink-500/10 text-pink-400' :
                      'bg-purple-500/10 text-purple-400'
                    )}>
                      {trade.type === 'directional' ? 'DIR' : trade.type === 'stock' ? 'STOCK' : trade.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {trade.exitDate ? formatDateShort(trade.exitDate) : '-'}
                    {trade.reason ? ` · ${trade.reason}` : ''}
                  </div>
                </div>
                <span className={cn('text-sm font-bold flex-shrink-0', privacyMode ? 'text-muted' : trade.pl >= 0 ? 'text-profit' : 'text-loss')}>
                  {privacyMode ? '$***' : `${trade.pl >= 0 ? '+' : ''}${rawFormatCurrency(trade.pl)}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <CloseTradeModal
        isOpen={!!closeModalTrade}
        trade={closeModalTrade}
        onClose={() => setCloseModalTrade(null)}
        onSubmit={handleCloseTrade}
        onRoll={handleRollTrade}
      />

      {/* Quick-Add Modals */}
      <AddTradeModal
        isOpen={quickAddType === 'csp'}
        onClose={() => setQuickAddType(null)}
        onSubmit={(trade) => { addTrade(trade); setQuickAddType(null); }}
      />
      <AddCCModal
        isOpen={quickAddType === 'cc'}
        onClose={() => setQuickAddType(null)}
        onSubmit={(call) => { addCall(call); setQuickAddType(null); }}
      />
      <AddDirectionalModal
        isOpen={quickAddType === 'directional'}
        onClose={() => setQuickAddType(null)}
        onSubmit={(trade) => { addDirectional(trade); setQuickAddType(null); }}
      />
      <AddSpreadModal
        isOpen={quickAddType === 'spread'}
        onClose={() => setQuickAddType(null)}
        onSubmit={(spread) => { addSpread(spread); setQuickAddType(null); }}
      />

      {/* CSV Import */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={(type, rows) => {
          rows.forEach(row => {
            const normalizedRow: Record<string, unknown> = {};
            Object.entries(row).forEach(([k, v]) => {
              const num = parseFloat(v);
              normalizedRow[k] = isNaN(num) || k.toLowerCase().includes('date') || k === 'ticker' || k === 'optionType' || k === 'spreadType' || k === 'notes'
                ? v
                : num;
            });
            if (type === 'csp') addTrade(normalizedRow as unknown as Parameters<typeof addTrade>[0]);
            else if (type === 'cc') addCall(normalizedRow as unknown as Parameters<typeof addCall>[0]);
            else if (type === 'directional') addDirectional(normalizedRow as unknown as Parameters<typeof addDirectional>[0]);
            else if (type === 'spread') addSpread(normalizedRow as unknown as Parameters<typeof addSpread>[0]);
          });
        }}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        trades={allCSPTrades}
        coveredCalls={allCCTrades}
        directionalTrades={allDirectional}
        spreads={allSpreads}
        holdings={holdings}
        stockEvents={stockEvents}
        tickerNames={tickerNames}
      />

      {/* Quick-Add FAB */}
      <QuickAddFAB onSelect={(type) => setQuickAddType(type)} />
    </div>
  );
}
