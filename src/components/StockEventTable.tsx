'use client';

import { useState, useMemo } from 'react';
import { StockEvent } from '@/types';
import { formatDateShort, cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

type SortKey = 'ticker' | 'shares' | 'costBasis' | 'salePrice' | 'saleDate' | 'realizedPL';
type SortDirection = 'asc' | 'desc';

interface StockEventTableProps {
  events: StockEvent[];
  onDelete?: (event: StockEvent) => void;
}

export function StockEventTable({ events, onDelete }: StockEventTableProps) {
  const { formatCurrency, privacyMode } = useFormatters();
  const [sortKey, setSortKey] = useState<SortKey>('saleDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterTLH, setFilterTLH] = useState<'all' | 'tlh' | 'non-tlh'>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...events];

    if (filterTicker) {
      result = result.filter(e => e.ticker.toLowerCase().includes(filterTicker.toLowerCase()));
    }

    if (filterTLH === 'tlh') {
      result = result.filter(e => e.isTaxLossHarvest);
    } else if (filterTLH === 'non-tlh') {
      result = result.filter(e => !e.isTaxLossHarvest);
    }

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [events, filterTicker, filterTLH, sortKey, sortDirection]);

  const uniqueTickers = Array.from(new Set(events.map(e => e.ticker)));

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

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-background/50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-foreground font-medium mb-2">No stock events yet</h3>
        <p className="text-muted text-sm">Log a stock sale or tax loss harvest to get started</p>
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

        <select
          value={filterTLH}
          onChange={(e) => setFilterTLH(e.target.value as 'all' | 'tlh' | 'non-tlh')}
          className="input-field w-auto"
        >
          <option value="all">All Events</option>
          <option value="tlh">TLH Only</option>
          <option value="non-tlh">Non-TLH</option>
        </select>

        {(filterTicker || filterTLH !== 'all') && (
          <button
            onClick={() => { setFilterTicker(''); setFilterTLH('all'); }}
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
              <SortHeader label="Shares" sortKeyVal="shares" />
              <SortHeader label="Cost Basis" sortKeyVal="costBasis" />
              <SortHeader label="Sale Price" sortKeyVal="salePrice" />
              <SortHeader label="Sale Date" sortKeyVal="saleDate" />
              <SortHeader label="Realized P/L" sortKeyVal="realizedPL" />
              <th className="px-4 py-3 text-left stat-label">Type</th>
              <th className="px-4 py-3 text-left stat-label">Replacement</th>
              <th className="px-4 py-3 text-right stat-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((event) => (
              <tr key={event.id} className="hover:bg-background/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <span className="text-pink-400 text-xs font-bold">{event.ticker.slice(0, 2)}</span>
                    </div>
                    <span className="font-medium text-foreground">{event.ticker}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '***' : event.shares}</td>
                <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : `$${event.costBasis.toFixed(2)}`}</td>
                <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : `$${event.salePrice.toFixed(2)}`}</td>
                <td className="px-4 py-3 text-sm text-muted">{formatDateShort(event.saleDate)}</td>
                <td className={cn('px-4 py-3 text-sm font-semibold', privacyMode ? 'text-muted' : event.realizedPL >= 0 ? 'text-profit' : 'text-loss')}>
                  {privacyMode ? '$***' : `${event.realizedPL >= 0 ? '+' : ''}${formatCurrency(event.realizedPL)}`}
                </td>
                <td className="px-4 py-3">
                  {event.isTaxLossHarvest ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-caution/10 text-caution">TLH</span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-muted/10 text-muted">Stock Sale</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted">
                  {event.replacementTradeType ? (
                    <span className="px-2 py-1 bg-background/50 rounded-lg text-xs">
                      {event.replacementTradeType.toUpperCase()}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {onDelete && (
                    <button
                      onClick={() => onDelete(event)}
                      className="text-muted hover:text-loss text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && events.length > 0 && (
        <div className="text-center py-8 text-muted">No events match your filters</div>
      )}
    </div>
  );
}
