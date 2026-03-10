'use client';

import { useState, useMemo } from 'react';
import { useHoldings } from '@/hooks/useHoldings';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useStockAggregates } from '@/hooks/useStockAggregates';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { HoldingsTable } from '@/components/HoldingsTable';
import { HoldingsModal } from '@/components/HoldingsModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatCard } from '@/components/StatCard';
import { PortfolioDonutChart } from '@/components/PortfolioDonutChart';
import { PortfolioReturnChart } from '@/components/PortfolioReturnChart';
import { ReturnRankingChart } from '@/components/ReturnRankingChart';
import { HoldingsTreemap } from '@/components/HoldingsTreemap';
import { SkeletonStatCards, SkeletonTable, ErrorState } from '@/components/SkeletonLoader';
import { StockHolding } from '@/types';
import { useFormatters } from '@/hooks/useFormatters';
import { cn } from '@/lib/utils';

export default function HoldingsPage() {
  const { formatCurrency, formatPercent, mask } = useFormatters();
  const {
    holdings, totalShares, totalCostBasis, uniqueTickers,
    addHolding, updateHolding, deleteHolding, isLoading, error, retry,
  } = useHoldings();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalHolding, setEditModalHolding] = useState<StockHolding | null>(null);
  const [deleteModalHolding, setDeleteModalHolding] = useState<StockHolding | null>(null);

  // Extract unique tickers for price fetching
  const tickerList = useMemo(() => {
    const set = new Set<string>();
    holdings.forEach((h) => set.add(h.ticker));
    return Array.from(set).sort();
  }, [holdings]);

  // Include SPY for benchmark comparison
  const aggTickerList = useMemo(() => {
    const list = [...tickerList];
    if (list.length > 0 && !list.includes('SPY')) list.push('SPY');
    return list;
  }, [tickerList]);

  const { prices: priceMap, isLoading: pricesLoading } = useStockPrices(tickerList);
  const { sparklines, yearRanges, allBars } = useStockAggregates(aggTickerList);
  const { label: marketLabel, isOpen: marketOpen, isExtended } = useMarketStatus();

  // Compute portfolio-level market stats
  const marketStats = useMemo(() => {
    let totalMarketValue = 0;
    let totalWeightedDayChange = 0;

    for (const h of holdings) {
      const sp = priceMap.get(h.ticker);
      if (sp) {
        const mv = h.shares * sp.price;
        totalMarketValue += mv;
        totalWeightedDayChange += h.shares * sp.change;
      }
    }

    const unrealizedPL = totalMarketValue - totalCostBasis;
    const hasPrices = priceMap.size > 0;
    const dayChangePercent = totalMarketValue > 0
      ? (totalWeightedDayChange / (totalMarketValue - totalWeightedDayChange)) * 100
      : 0;

    return { totalMarketValue, unrealizedPL, dayChangePercent, hasPrices };
  }, [holdings, priceMap, totalCostBasis]);

  const confirmDelete = () => {
    if (deleteModalHolding) {
      deleteHolding(deleteModalHolding.id);
      setDeleteModalHolding(null);
    }
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Holdings</h1>
          <p className="text-muted mt-1">Track your share positions</p>
        </div>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Stock Holdings</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted">Track your share positions</p>
            {!isLoading && holdings.length > 0 && (
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                marketOpen
                  ? 'bg-profit/10 text-profit'
                  : isExtended
                    ? 'bg-caution/10 text-caution'
                    : 'bg-muted/10 text-muted'
              )}>
                {marketLabel}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          + Add Holding
        </button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <SkeletonStatCards count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Tickers"
            value={uniqueTickers.toString()}
            subValue={`${holdings.length} lots`}
          />
          <StatCard
            label="Total Shares"
            value={mask(totalShares.toLocaleString())}
            subValue="Across all positions"
          />
          <StatCard
            label="Total Cost Basis"
            value={formatCurrency(totalCostBasis)}
            variant="accent"
            subValue="All holdings"
          />
          <StatCard
            label="Market Value"
            value={marketStats.hasPrices ? formatCurrency(marketStats.totalMarketValue) : '—'}
            variant="accent"
            subValue={pricesLoading ? 'Loading...' : (marketStats.hasPrices ? 'Live prices' : 'No price data')}
          />
          <StatCard
            label="Unrealized P/L"
            value={marketStats.hasPrices ? formatCurrency(marketStats.unrealizedPL) : '—'}
            variant={marketStats.unrealizedPL >= 0 ? 'profit' : 'loss'}
            subValue={marketStats.hasPrices && totalCostBasis > 0
              ? formatPercent((marketStats.unrealizedPL / totalCostBasis) * 100) + ' return'
              : ''}
          />
          <StatCard
            label="Day Change"
            value={marketStats.hasPrices ? formatPercent(marketStats.dayChangePercent) : '—'}
            variant={marketStats.dayChangePercent >= 0 ? 'profit' : 'loss'}
            subValue={pricesLoading ? 'Loading...' : (marketStats.hasPrices ? 'Portfolio weighted' : 'No price data')}
          />
        </div>
      )}

      {/* Portfolio Donut */}
      {marketStats.hasPrices && holdings.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Portfolio Allocation</h2>
          <PortfolioDonutChart holdings={holdings} priceMap={priceMap} />
        </div>
      )}

      {/* Performance Charts */}
      {marketStats.hasPrices && holdings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cumulative Return vs S&P 500 */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Stocks vs S&P 500</h2>
            <p className="text-xs text-muted mb-4">1-year return per stock vs benchmark</p>
            <PortfolioReturnChart holdings={holdings} priceMap={priceMap} allBars={allBars} />
          </div>

          {/* Return Ranking */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Return by Ticker</h2>
            <p className="text-xs text-muted mb-4">Total return % from cost basis</p>
            <ReturnRankingChart holdings={holdings} priceMap={priceMap} />
          </div>
        </div>
      )}

      {/* Holdings Heatmap */}
      {marketStats.hasPrices && holdings.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Holdings Heatmap</h2>
          <p className="text-xs text-muted mb-4">Size = market value, color = day change</p>
          <HoldingsTreemap holdings={holdings} priceMap={priceMap} />
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Holdings</h2>
          <span className="text-muted text-sm">{holdings.length} total</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <HoldingsTable
            holdings={holdings}
            priceMap={priceMap}
            pricesLoading={pricesLoading}
            sparklines={sparklines}
            yearRanges={yearRanges}
            onEdit={(holding) => setEditModalHolding(holding)}
            onDelete={(holding) => setDeleteModalHolding(holding)}
          />
        )}
      </div>

      {/* Modals */}
      <HoldingsModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addHolding}
      />
      <HoldingsModal
        isOpen={!!editModalHolding}
        onClose={() => setEditModalHolding(null)}
        onSubmit={addHolding}
        editHolding={editModalHolding}
        onUpdate={updateHolding}
      />
      <ConfirmModal
        isOpen={!!deleteModalHolding}
        title="Delete Holding"
        message={deleteModalHolding ? `Delete ${deleteModalHolding.ticker} ${deleteModalHolding.shares} shares?` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalHolding(null)}
      />
    </div>
  );
}
