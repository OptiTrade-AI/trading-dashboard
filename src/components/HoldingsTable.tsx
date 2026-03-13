'use client';

import { useState, useMemo, Fragment } from 'react';
import { StockHolding, StockPrice, AggBar } from '@/types';
import { formatDateShort, cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { TickerSparkline } from './TickerSparkline';
import { FiftyTwoWeekBar } from './FiftyTwoWeekBar';
import { IntradayChart } from './IntradayChart';

type SortKey = 'ticker' | 'shares' | 'costBasisPerShare' | 'acquiredDate' | 'totalCost' | 'price' | 'mktValue' | 'pl' | 'dayChg';
type SortDirection = 'asc' | 'desc';

interface GroupedHolding {
  ticker: string;
  lots: StockHolding[];
  shares: number;
  totalCost: number;
  costBasisPerShare: number; // weighted average
  earliestDate: string;
}

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
  const [expandedLots, setExpandedLots] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, StockHolding[]>();
    for (const h of holdings) {
      const key = h.ticker.toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }

    const groups: GroupedHolding[] = [];
    for (const [ticker, lots] of map) {
      const shares = lots.reduce((s, l) => s + l.shares, 0);
      const totalCost = lots.reduce((s, l) => s + l.shares * l.costBasisPerShare, 0);
      const costBasisPerShare = shares > 0 ? totalCost / shares : 0;
      const earliestDate = lots.reduce((min, l) => l.acquiredDate < min ? l.acquiredDate : min, lots[0].acquiredDate);
      groups.push({ ticker, lots, shares, totalCost, costBasisPerShare, earliestDate });
    }

    return groups;
  }, [holdings]);

  const getGroupValue = (g: GroupedHolding, key: SortKey): string | number => {
    const sp = priceMap?.get(g.ticker);
    switch (key) {
      case 'ticker': return g.ticker;
      case 'shares': return g.shares;
      case 'costBasisPerShare': return g.costBasisPerShare;
      case 'totalCost': return g.totalCost;
      case 'price': return sp?.price ?? 0;
      case 'mktValue': return sp ? g.shares * sp.price : 0;
      case 'pl': return sp ? (g.shares * sp.price) - g.totalCost : 0;
      case 'dayChg': return sp?.changePercent ?? 0;
      case 'acquiredDate': return g.earliestDate;
    }
  };

  const filtered = useMemo(() => {
    let result = [...grouped];

    if (filterTicker) {
      result = result.filter(g => g.ticker.toLowerCase().includes(filterTicker.toLowerCase()));
    }

    result.sort((a, b) => {
      const aVal = getGroupValue(a, sortKey);
      const bVal = getGroupValue(b, sortKey);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, filterTicker, sortKey, sortDirection, priceMap]);

  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker)));
  const totalColumns = 13;

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
              <SortHeader label="Avg Cost" sortKeyVal="costBasisPerShare" />
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
            {filtered.map((group) => {
              const sp = priceMap?.get(group.ticker);
              const mktValue = sp ? group.shares * sp.price : null;
              const pl = mktValue !== null ? mktValue - group.totalCost : null;
              const isChartExpanded = expandedRow === group.ticker;
              const isLotsExpanded = expandedLots === group.ticker;
              const hasMultipleLots = group.lots.length > 1;
              const yearRange = yearRanges?.get(group.ticker);

              return (
                <Fragment key={group.ticker}>
                  <tr className="hover:bg-background/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedRow(isChartExpanded ? null : group.ticker)}
                          className="text-muted hover:text-foreground transition-colors flex-shrink-0"
                          title={isChartExpanded ? 'Collapse intraday chart' : 'Expand intraday chart'}
                        >
                          <svg
                            className={cn('w-4 h-4 transition-transform', isChartExpanded && 'rotate-90')}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <span className="text-blue-400 text-xs font-bold">{group.ticker.slice(0, 2)}</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{group.ticker}</span>
                          {hasMultipleLots && (
                            <button
                              onClick={() => setExpandedLots(isLotsExpanded ? null : group.ticker)}
                              className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                              title={isLotsExpanded ? 'Hide lots' : 'Show individual lots'}
                            >
                              {group.lots.length} lots {isLotsExpanded ? '▴' : '▾'}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TickerSparkline bars={sparklines?.get(group.ticker)} ticker={group.ticker} />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '***' : group.shares}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : formatCurrency(group.costBasisPerShare)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{privacyMode ? '$***' : formatCurrency(group.totalCost)}</td>

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

                    <td className="px-4 py-3 text-sm text-muted">{formatDateShort(group.earliestDate)}</td>
                    <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">
                      {hasMultipleLots ? `${group.lots.length} lots` : (group.lots[0].notes || '-')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {!hasMultipleLots && (
                        <div className="flex items-center justify-end gap-3">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(group.lots[0])}
                              className="text-muted hover:text-accent text-xs font-medium transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(group.lots[0])}
                              className="text-muted hover:text-loss text-xs font-medium transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expandable sub-lots for multi-lot tickers */}
                  {isLotsExpanded && hasMultipleLots && [...group.lots]
                    .sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
                    .map((lot) => {
                      const lotCost = lot.shares * lot.costBasisPerShare;
                      const lotMktValue = sp ? lot.shares * sp.price : null;
                      const lotPl = lotMktValue !== null ? lotMktValue - lotCost : null;

                      return (
                        <tr key={lot.id} className="bg-background/10 hover:bg-background/20 transition-colors">
                          <td className="px-4 py-2 pl-16">
                            <span className="text-xs text-muted">Lot</span>
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-xs text-muted">{privacyMode ? '***' : lot.shares}</td>
                          <td className="px-4 py-2 text-xs text-muted">{privacyMode ? '$***' : formatCurrency(lot.costBasisPerShare)}</td>
                          <td className="px-4 py-2 text-xs text-muted">{privacyMode ? '$***' : formatCurrency(lotCost)}</td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-xs text-muted">
                            {lotMktValue !== null ? formatCurrency(lotMktValue) : '—'}
                          </td>
                          <td className={cn('px-4 py-2 text-xs', lotPl !== null ? (lotPl >= 0 ? 'text-profit' : 'text-loss') : 'text-muted')}>
                            {lotPl !== null ? formatCurrency(lotPl) : '—'}
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 hidden lg:table-cell" />
                          <td className="px-4 py-2 text-xs text-muted">{formatDateShort(lot.acquiredDate)}</td>
                          <td className="px-4 py-2 text-xs text-muted max-w-[200px] truncate">{lot.notes || '-'}</td>
                          <td className="px-4 py-2 text-xs text-right">
                            <div className="flex items-center justify-end gap-3">
                              {onEdit && (
                                <button
                                  onClick={() => onEdit(lot)}
                                  className="text-muted hover:text-accent text-xs font-medium transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  onClick={() => onDelete(lot)}
                                  className="text-muted hover:text-loss text-xs font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {isChartExpanded && (
                    <tr key={`${group.ticker}-intraday`}>
                      <td colSpan={totalColumns} className="px-4 py-4 bg-background/10">
                        <div className="max-w-4xl mx-auto">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-foreground">{group.ticker}</span>
                            <span className="text-xs text-muted">Intraday (5-min)</span>
                          </div>
                          <IntradayChart ticker={group.ticker} prevClose={sp ? sp.price - sp.change : undefined} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
