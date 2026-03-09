'use client';

import { useState, useMemo } from 'react';
import { DirectionalTrade } from '@/types';
import { formatCurrency, formatDateShort, calculateDirectionalPL, calculateDirectionalPLPercent, calculateDTE, cn } from '@/lib/utils';

type SortKey = keyof DirectionalTrade | 'pl' | 'plPercent' | 'currentDTE';
type SortDirection = 'asc' | 'desc';

interface DirectionalTableProps {
  trades: DirectionalTrade[];
  onClose?: (trade: DirectionalTrade) => void;
  onDelete?: (trade: DirectionalTrade) => void;
  onViewRollChain?: (rollChainId: string) => void;
}

export function DirectionalTable({ trades, onClose, onDelete, onViewRollChain }: DirectionalTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('entryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'call' | 'put'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    if (filterStatus !== 'all') {
      result = result.filter((t) => t.status === filterStatus);
    }

    if (filterTicker) {
      result = result.filter((t) =>
        t.ticker.toLowerCase().includes(filterTicker.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      result = result.filter((t) => t.optionType === filterType);
    }

    if (dateFrom) {
      result = result.filter((t) => t.entryDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((t) => t.entryDate <= dateTo);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortKey) {
        case 'pl':
          aVal = calculateDirectionalPL(a);
          bVal = calculateDirectionalPL(b);
          break;
        case 'plPercent':
          aVal = calculateDirectionalPLPercent(a);
          bVal = calculateDirectionalPLPercent(b);
          break;
        case 'currentDTE':
          aVal = calculateDTE(a.expiration);
          bVal = calculateDTE(b.expiration);
          break;
        default:
          aVal = a[sortKey] ?? '';
          bVal = b[sortKey] ?? '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [trades, filterStatus, filterTicker, filterType, dateFrom, dateTo, sortKey, sortDirection]);

  const uniqueTickers = Array.from(new Set(trades.map((t) => t.ticker)));

  const SortHeader = ({ label, sortKeyVal, className = '' }: { label: string; sortKeyVal: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(sortKeyVal)}
      className={cn(
        'px-4 py-3 text-left stat-label cursor-pointer hover:text-foreground transition-colors',
        className
      )}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <span className="text-amber-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-background/50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-foreground font-medium mb-2">No directional trades yet</h3>
        <p className="text-muted text-sm">Add your first directional trade to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'open' | 'closed')}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'call' | 'put')}
          className="input-field w-auto"
        >
          <option value="all">All Types</option>
          <option value="call">Calls</option>
          <option value="put">Puts</option>
        </select>

        <select
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Tickers</option>
          {uniqueTickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From"
          className="input-field w-auto"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To"
          className="input-field w-auto"
        />

        {(filterStatus !== 'all' || filterTicker || filterType !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setFilterStatus('all');
              setFilterTicker('');
              setFilterType('all');
              setDateFrom('');
              setDateTo('');
            }}
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
              <th className="px-4 py-3 text-left stat-label">Type</th>
              <SortHeader label="Strike" sortKeyVal="strike" />
              <SortHeader label="Qty" sortKeyVal="contracts" />
              <SortHeader label="Exp" sortKeyVal="expiration" />
              <SortHeader label="DTE" sortKeyVal="currentDTE" />
              <SortHeader label="Cost" sortKeyVal="costAtOpen" />
              <SortHeader label="Status" sortKeyVal="status" />
              <SortHeader label="P/L" sortKeyVal="pl" />
              <SortHeader label="P/L %" sortKeyVal="plPercent" />
              <SortHeader label="Entry" sortKeyVal="entryDate" />
              <SortHeader label="Exit" sortKeyVal="exitDate" />
              <th className="px-4 py-3 text-left stat-label">Reason</th>
              <th className="px-4 py-3 text-right stat-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredAndSortedTrades.map((trade) => {
              const pl = calculateDirectionalPL(trade);
              const plPercent = calculateDirectionalPLPercent(trade);
              const currentDTE = calculateDTE(trade.expiration);

              return (
                <tr key={trade.id} className="hover:bg-background/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <span className="text-amber-400 text-xs font-bold">{trade.ticker.slice(0, 2)}</span>
                      </div>
                      <span className="font-medium text-foreground">{trade.ticker}</span>
                      {trade.rollChainId && (
                        <button
                          onClick={() => onViewRollChain?.(trade.rollChainId!)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="View roll history"
                        >
                          R{trade.rollNumber || 1}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-bold',
                      trade.optionType === 'call'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    )}>
                      {trade.optionType === 'call' ? 'C' : 'P'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">${trade.strike}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {trade.contracts}
                    {trade.originalContracts && (
                      <span className="ml-1 text-[10px] text-caution font-medium">
                        /{trade.originalContracts}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {formatDateShort(trade.expiration)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {trade.status === 'open' ? `${currentDTE}d` : `${trade.dteAtEntry}d`}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatCurrency(trade.costAtOpen)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium',
                        trade.status === 'open'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-muted/10 text-muted'
                      )}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm font-semibold',
                      trade.status !== 'open'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {trade.status !== 'open' ? (pl >= 0 ? '+' : '') + formatCurrency(pl) : '-'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm',
                      trade.status !== 'open'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {trade.status !== 'open' ? `${plPercent.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatDateShort(trade.entryDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {trade.exitDate ? formatDateShort(trade.exitDate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {trade.exitReason ? (
                      <span className="px-2 py-1 bg-background/50 rounded-lg text-muted text-xs">
                        {trade.exitReason}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-3">
                      {trade.status === 'open' && onClose && (
                        <button
                          onClick={() => onClose(trade)}
                          className="text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors"
                        >
                          Close
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(trade)}
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
          </tbody>
        </table>
      </div>

      {filteredAndSortedTrades.length === 0 && trades.length > 0 && (
        <div className="text-center py-8 text-muted">No directional trades match your filters</div>
      )}
    </div>
  );
}
