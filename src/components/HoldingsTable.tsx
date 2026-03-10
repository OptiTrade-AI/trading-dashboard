'use client';

import { useState, useMemo } from 'react';
import { StockHolding, StockPrice, AggBar } from '@/types';
import { formatDateShort, cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { TickerSparkline } from './TickerSparkline';
import { FiftyTwoWeekBar } from './FiftyTwoWeekBar';
import { IntradayChart } from './IntradayChart';

type SortKey = 'ticker' | 'shares' | 'costBasisPerShare' | 'acquiredDate' | 'totalCost' | 'price' | 'mktValue' | 'pl' | 'dayChg';
type SortDirection = 'asc' | 'desc';

interface HoldingsTableProps {
  holdings: StockHolding[];
  priceMap?: Map<string, StockPrice>;
  pricesLoading?: boolean;
  sparklines?: Map<string, AggBar[]>;
  yearRanges?: Map<string, { low: number; high: number }>;
  onEdit?: (holding: StockHolding) => void;
  onDelete?: (holding: StockHolding) => void;
}

export function HoldingsTable({ holdings, priceMap, pricesLoading, sparklines, yearRanges, onEdit, onDelete }: HoldingsTableProps) {
  const { formatCurrency, formatPercent, privacyMode } = useFormatters();
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterTicker, setFilterTicker] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const getComputedValue = (h: StockHolding, key: SortKey): string | number => {
    const sp = priceMap?.get(h.ticker);
    switch (key) {
      case 'totalCost': return h.shares * h.costBasisPerShare;
      case 'price': return sp?.price ?? 0;
      case 'mktValue': return sp ? h.shares * sp.price : 0;
      case 'pl': return sp ? (h.shares * sp.price) - (h.shares * h.costBasisPerShare) : 0;
      case 'dayChg': return sp?.changePercent ?? 0;
      default: return h[key as keyof StockHolding] as string | number;
    }
  };

  const filtered = useMemo(() => {
    let result = [...holdings];

    if (filterTicker) {
      result = result.filter(h => h.ticker.toLowerCase().includes(filterTicker.toLowerCase()));
    }

    result.sort((a, b) => {
      const aVal = getComputedValue(a, sortKey);
      const bVal = getComputedValue(b, sortKey);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, filterTicker, sortKey, sortDirection, priceMap]);

  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker)));
  const totalColumns = 12; // ticker + 7d + shares + cost/share + total cost + price + mkt value + p/l + day chg + 52w + acquired + notes + actions

  const SortHeader = ({ label, sortKeyVal, className = '' }: { label: string; sortKeyVal: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(sortKeyVal)}
      className={cn('px-4 py-3 text-left stat-label cursor-pointer hover:text-foreground transition-colors', className)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  const ShimmerCell = () => (
    <td className="px-4 py-3">
      <div className="h-4 w-16 bg-foreground/5 rounded animate-pulse" />
    </td>
  );

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-background/50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📦</span>
        </div>
        <h3 className="text-foreground font-medium mb-2">No holdings yet</h3>
        <p className="text-muted text-sm">Add a stock holding to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Tickers</option>
          {uniqueTickers.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {filterTicker && (
          <button
            onClick={() => setFilterTicker('')}
            className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full">
          <thead>
            <tr className="bg-background/30 border-b border-border/50">
              <SortHeader label="Ticker" sortKeyVal="ticker" />
              <th className="px-4 py-3 text-left stat-label">7D</th>
              <SortHeader label="Shares" sortKeyVal="shares" />
              <SortHeader label="Cost/Share" sortKeyVal="costBasisPerShare" />
              <SortHeader label="Total Cost" sortKeyVal="totalCost" />
              <SortHeader label="Price" sortKeyVal="price" />
              <SortHeader label="Mkt Value" sortKeyVal="mktValue" />
              <SortHeader label="P/L" sortKeyVal="pl" />
              <SortHeader label="Day Chg" sortKeyVal="dayChg" />
              <th className="px-4 py-3 text-left stat-label hidden lg:table-cell">52W Range</th>
              <SortHeader label="Acquired" sortKeyVal="acquiredDate" />
              <th className="px-4 py-3 text-left stat-label">Notes</th>
              <th className="px-4 py-3 text-right stat-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((holding) => {
              const totalCost = holding.shares * holding.costBasisPerShare;
              const sp = priceMap?.get(holding.ticker);
              const mktValue = sp ? holding.shares * sp.price : null;
              const pl = mktValue !== null ? mktValue - totalCost : null;
              const isExpanded = expandedRow === holding.id;
              const yearRange = yearRanges?.get(holding.ticker);

              return (
                <>
                  <tr key={holding.id} className="hover:bg-background/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : holding.id)}
                          className="text-muted hover:text-foreground transition-colors flex-shrink-0"
                          title={isExpanded ? 'Collapse intraday chart' : 'Expand intraday chart'}
                        >
                          <svg
                            className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <span className="text-blue-400 text-xs font-bold">{holding.ticker.slice(0, 2)}</span>
                        </div>
                        <span className="font-medium text-foreground">{holding.ticker}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TickerSparkline bars={sparklines?.get(holding.ticker)} ticker={holding.ticker} />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '***' : holding.shares}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : formatCurrency(holding.costBasisPerShare)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{privacyMode ? '$***' : formatCurrency(totalCost)}</td>

                    {/* Live price columns */}
                    {pricesLoading ? (
                      <>
                        <ShimmerCell />
                        <ShimmerCell />
                        <ShimmerCell />
                        <ShimmerCell />
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {sp ? formatCurrency(sp.price) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
                          {mktValue !== null ? formatCurrency(mktValue) : '—'}
                        </td>
                        <td className={cn('px-4 py-3 text-sm font-semibold', pl !== null ? (pl >= 0 ? 'text-profit' : 'text-loss') : 'text-muted')}>
                          {pl !== null ? formatCurrency(pl) : '—'}
                        </td>
                        <td className={cn('px-4 py-3 text-sm font-medium', sp ? (sp.changePercent >= 0 ? 'text-profit' : 'text-loss') : 'text-muted')}>
                          {sp ? formatPercent(sp.changePercent) : '—'}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3 hidden lg:table-cell">
                      {yearRange && sp ? (
                        <FiftyTwoWeekBar low={yearRange.low} high={yearRange.high} current={sp.price} />
                      ) : pricesLoading ? (
                        <div className="h-4 w-20 bg-foreground/5 rounded animate-pulse" />
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-muted">{formatDateShort(holding.acquiredDate)}</td>
                    <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">{holding.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-3">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(holding)}
                            className="text-muted hover:text-accent text-xs font-medium transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(holding)}
                            className="text-muted hover:text-loss text-xs font-medium transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${holding.id}-intraday`}>
                      <td colSpan={totalColumns} className="px-4 py-4 bg-background/10">
                        <div className="max-w-4xl mx-auto">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-foreground">{holding.ticker}</span>
                            <span className="text-xs text-muted">Intraday (5-min)</span>
                          </div>
                          <IntradayChart ticker={holding.ticker} prevClose={sp ? sp.price - sp.change : undefined} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && holdings.length > 0 && (
        <div className="text-center py-8 text-muted">No holdings match your filters</div>
      )}
    </div>
  );
}
