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
import { PressureCard } from '@/components/PressureCard';
import { CloseTradeModal } from '@/components/TradeModal';
import { SkeletonDashboard } from '@/components/SkeletonLoader';
import { PositionsTimeline } from '@/components/dashboard/PositionsTimeline';
import { CapitalAllocationCard } from '@/components/dashboard/CapitalAllocationCard';
import { PortfolioGreeksCard } from '@/components/dashboard/PortfolioGreeksCard';
import { CompactHeat } from '@/components/dashboard/CompactHeat';
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
    openTrades,
    closedTrades,
    accountSettings,
    totalCollateral,
    heat,
    closeTrade,
    rollTrade,
    updateAccountValue,
    isLoading: tradesLoading,
  } = useTrades();

  const { openCalls, closedCalls, isLoading: ccLoading } = useCoveredCalls();

  const {
    openTrades: openDirectional,
    closedTrades: closedDirectional,
    trades: allDirectional,
    isLoading: dirLoading,
  } = useDirectionalTrades();

  const {
    openSpreads,
    closedSpreads,
    spreads: allSpreads,
    isLoading: spreadsLoading,
  } = useSpreads();

  const {
    stockEvents,
    totalStockPL,
    isLoading: stockLoading,
  } = useStockEvents();

  const { positions: optionPositions } = useOptionQuotes();
  useMarketStatus(); // triggers SWR caching for child components

  // Collect all unique tickers for company name lookup
  const allTickers = useMemo(() => {
    const set = new Set<string>();
    openTrades.forEach(t => set.add(t.ticker));
    openCalls.forEach(c => set.add(c.ticker));
    openDirectional.forEach(t => set.add(t.ticker));
    openSpreads.forEach(s => set.add(s.ticker));
    return Array.from(set);
  }, [openTrades, openCalls, openDirectional, openSpreads]);
  const { nameMap: tickerNames } = useTickerDetails(allTickers);

  const isLoading = tradesLoading || ccLoading || dirLoading || spreadsLoading || stockLoading;

  const [editingAccountValue, setEditingAccountValue] = useState(false);
  const [accountValueInput, setAccountValueInput] = useState(
    accountSettings.accountValue.toString()
  );
  const [closeModalTrade, setCloseModalTrade] = useState<Trade | null>(null);

  const handleSaveAccountValue = () => {
    const value = parseFloat(accountValueInput);
    if (!isNaN(value) && value > 0) {
      updateAccountValue(value);
    }
    setEditingAccountValue(false);
  };

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
        detail: `x${t.contracts}`,
        value: formatCurrency(t.premiumCollected),
        valueLabel: 'premium',
        subDetail: privacyMode ? '**% ROC' : `${calculateReturnOnCollateral(t).toFixed(1)}% ROC`,
        canClose: true,
        trade: t,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        maxPremium: t.premiumCollected,
        delta: oq?.delta ?? null,
        theta: oq?.theta ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
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
        detail: `x${c.contracts}`,
        value: formatCurrency(c.premiumCollected),
        valueLabel: 'premium',
        subDetail: privacyMode ? '*** shares' : `${c.sharesHeld} shares`,
        canClose: false,
        trade: null,
        rawTrade: c,
        unrealizedPL: oq?.unrealizedPL ?? null,
        maxPremium: c.premiumCollected,
        delta: oq?.delta ?? null,
        theta: oq?.theta ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(c.ticker) ?? null,
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
        detail: `x${t.contracts}`,
        value: formatCurrency(t.costAtOpen),
        valueLabel: 'cost',
        subDetail: '',
        canClose: false,
        trade: null,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        maxPremium: t.costAtOpen,
        delta: oq?.delta ?? null,
        theta: oq?.theta ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
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
        detail: `x${t.contracts}`,
        value: privacyMode ? '$***' : (t.netDebit < 0 ? `CR ${rawFormatCurrency(Math.abs(t.netDebit))}` : rawFormatCurrency(t.netDebit)),
        valueLabel: t.netDebit < 0 ? 'credit' : 'debit',
        subDetail: privacyMode ? 'Max loss: $***' : `Max loss: ${formatCurrency(t.maxLoss)}`,
        canClose: false,
        trade: null,
        rawTrade: t,
        unrealizedPL: oq?.unrealizedPL ?? null,
        maxPremium: t.netDebit < 0 ? Math.abs(t.netDebit) : t.maxProfit,
        delta: oq?.delta ?? null,
        theta: oq?.theta ?? null,
        iv: oq?.iv ?? null,
        companyName: tickerNames.get(t.ticker) ?? null,
      };
    }),
  ].sort((a, b) => a.dte - b.dte);

  // Total unrealized P/L across all open positions
  const totalUnrealizedPL = allOpenPositions.reduce(
    (sum, p) => sum + (p.unrealizedPL ?? 0), 0
  );
  const hasUnrealizedData = allOpenPositions.some(p => p.unrealizedPL !== null);

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
      {/* ── Hero Banner ── */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Account Value */}
          <div className="flex-1">
            <div className="stat-label mb-1">Account Value</div>
            {editingAccountValue ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={accountValueInput}
                  onChange={(e) => setAccountValueInput(e.target.value)}
                  className="input-field text-3xl font-bold py-1 w-48"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveAccountValue()}
                />
                <button onClick={handleSaveAccountValue} className="text-accent hover:text-accent-light font-medium text-sm">
                  Save
                </button>
              </div>
            ) : (
              <div
                onClick={() => { setAccountValueInput(accountSettings.accountValue.toString()); setEditingAccountValue(true); }}
                className="text-3xl font-bold text-foreground cursor-pointer hover:text-accent transition-colors group inline-flex items-center gap-2"
              >
                {formatCurrency(accountSettings.accountValue)}
                <span className="text-muted text-sm font-normal opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
              </div>
            )}
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
              <div>
                <div className="stat-label mb-1">Unrealized</div>
                <div className={cn('text-2xl font-bold', totalUnrealizedPL >= 0 ? 'text-profit' : 'text-loss')}>
                  {totalUnrealizedPL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPL)}
                </div>
                <div className="text-xs text-muted mt-1">
                  {allOpenPositions.filter(p => p.unrealizedPL !== null).length} positions live
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
        <PortfolioGreeksCard positions={allOpenPositions} privacyMode={privacyMode} />
      )}

      {/* ── Positions Under Pressure ── */}
      <PressureCard openPositions={allOpenPositions} />

      {/* ── Open Positions ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Open Positions</h2>
          <Link href="/log" className="btn-primary text-sm">+ New Trade</Link>
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
    </div>
  );
}
