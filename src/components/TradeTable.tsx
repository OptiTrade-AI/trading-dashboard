'use client';

import { useState, useMemo } from 'react';
import { Trade } from '@/types';
import {
  formatDateShort,
  calculatePL,
  calculatePLPercent,
  calculateDaysHeld,
  calculateAnnualizedReturn,
  cn,
} from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

type SortKey = keyof Trade | 'pl' | 'plPercent' | 'daysHeld' | 'annualizedReturn';
type SortDirection = 'asc' | 'desc';

interface TradeTableProps {
  trades: Trade[];
  onClose?: (trade: Trade) => void;
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onViewRollChain?: (rollChainId: string) => void;
}

export function TradeTable({ trades, onClose, onEdit, onDelete, onViewRollChain }: TradeTableProps) {
  const { formatCurrency, formatPercent, privacyMode } = useFormatters();
  const [sortKey, setSortKey] = useState<SortKey>('entryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('open');
  const [filterTicker, setFilterTicker] = useState('');
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
          aVal = calculatePL(a);
          bVal = calculatePL(b);
          break;
        case 'plPercent':
          aVal = calculatePLPercent(a);
          bVal = calculatePLPercent(b);
          break;
        case 'daysHeld':
          aVal = calculateDaysHeld(a);
          bVal = calculateDaysHeld(b);
          break;
        case 'annualizedReturn':
          aVal = calculateAnnualizedReturn(a);
          bVal = calculateAnnualizedReturn(b);
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
  }, [trades, filterStatus, filterTicker, dateFrom, dateTo, sortKey, sortDirection]);

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
          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-background/50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h3 className="text-foreground font-medium mb-2">No trades yet</h3>
        <p className="text-muted text-sm">Add your first trade to get started</p>
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

        {(filterStatus !== 'open' || filterTicker || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setFilterStatus('open');
              setFilterTicker('');
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
              <SortHeader label="Strike" sortKeyVal="strike" />
              <SortHeader label="Qty" sortKeyVal="contracts" />
              <SortHeader label="Exp" sortKeyVal="expiration" />
              <SortHeader label="DTE" sortKeyVal="dteAtEntry" />
              <SortHeader label="Premium" sortKeyVal="premiumCollected" />
              <SortHeader label="Collateral" sortKeyVal="collateral" />
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
              const pl = calculatePL(trade);
              const plPercent = calculatePLPercent(trade);

              return (
                <tr key={trade.id} className="hover:bg-background/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">{trade.ticker.slice(0, 2)}</span>
                      </div>
                      <span className="font-medium text-foreground">{trade.ticker}</span>
                      {trade.rollChainId && (
                        <button
                          onClick={() => onViewRollChain?.(trade.rollChainId!)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                          title="View roll history"
                        >
                          R{trade.rollNumber || 1}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : `$${trade.strike}`}</td>
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
                  <td className="px-4 py-3 text-sm text-muted">{trade.dteAtEntry}d</td>
                  <td className="px-4 py-3 text-sm text-profit font-medium">
                    {formatCurrency(trade.premiumCollected)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatCurrency(trade.collateral)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium',
                        trade.status === 'open'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-muted/10 text-muted'
                      )}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm font-semibold',
                      trade.status === 'closed'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {trade.status === 'closed' ? (privacyMode ? '$***' : (pl >= 0 ? '+' : '') + formatCurrency(pl)) : '-'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm',
                      trade.status === 'closed'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {trade.status === 'closed' ? formatPercent(plPercent, 2) : '-'}
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
                      {trade.status === 'open' && onEdit && (
                        <button
                          onClick={() => onEdit(trade)}
                          className="text-muted hover:text-foreground text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {trade.status === 'open' && onClose && (
                        <button
                          onClick={() => onClose(trade)}
                          className="text-accent hover:text-accent-light text-xs font-medium transition-colors"
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
        <div className="text-center py-8 text-muted">No trades match your filters</div>
      )}
    </div>
  );
}
