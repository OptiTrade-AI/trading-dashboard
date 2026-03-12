'use client';

import { useState, useMemo } from 'react';
import { CoveredCall } from '@/types';
import { formatDateShort, calculateDaysHeld, cn, calculateCCPL, calculateCCPLPercent } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

type SortKey = keyof CoveredCall | 'pl' | 'plPercent' | 'daysHeld';
type SortDirection = 'asc' | 'desc';

interface CCTableProps {
  calls: CoveredCall[];
  onClose?: (call: CoveredCall) => void;
  onEdit?: (call: CoveredCall) => void;
  onDelete?: (call: CoveredCall) => void;
  onViewRollChain?: (rollChainId: string) => void;
}

export function CCTable({ calls, onClose, onEdit, onDelete, onViewRollChain }: CCTableProps) {
  const { formatCurrency, formatPercent, privacyMode } = useFormatters();
  const [sortKey, setSortKey] = useState<SortKey>('entryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed' | 'called'>('open');
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

  const filteredAndSortedCalls = useMemo(() => {
    let result = [...calls];

    if (filterStatus !== 'all') {
      if (filterStatus === 'closed') {
        result = result.filter((c) => c.status === 'closed' || c.status === 'called');
      } else {
        result = result.filter((c) => c.status === filterStatus);
      }
    }

    if (filterTicker) {
      result = result.filter((c) =>
        c.ticker.toLowerCase().includes(filterTicker.toLowerCase())
      );
    }

    if (dateFrom) {
      result = result.filter((c) => c.entryDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.entryDate <= dateTo);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortKey) {
        case 'pl':
          aVal = calculateCCPL(a);
          bVal = calculateCCPL(b);
          break;
        case 'plPercent':
          aVal = calculateCCPLPercent(a);
          bVal = calculateCCPLPercent(b);
          break;
        case 'daysHeld':
          aVal = calculateDaysHeld({ entryDate: a.entryDate, exitDate: a.exitDate });
          bVal = calculateDaysHeld({ entryDate: b.entryDate, exitDate: b.exitDate });
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
  }, [calls, filterStatus, filterTicker, dateFrom, dateTo, sortKey, sortDirection]);

  const uniqueTickers = Array.from(new Set(calls.map((c) => c.ticker)));

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
          <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  if (calls.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-background/50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📈</span>
        </div>
        <h3 className="text-foreground font-medium mb-2">No covered calls yet</h3>
        <p className="text-muted text-sm">Add your first covered call to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'open' | 'closed' | 'called')}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="called">Called Away</option>
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
              <SortHeader label="Cost Basis" sortKeyVal="costBasis" />
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
            {filteredAndSortedCalls.map((call) => {
              const pl = calculateCCPL(call);
              const plPercent = calculateCCPLPercent(call);

              return (
                <tr key={call.id} className="hover:bg-background/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <span className="text-blue-400 text-xs font-bold">{call.ticker.slice(0, 2)}</span>
                      </div>
                      <span className="font-medium text-foreground">{call.ticker}</span>
                      {call.rollChainId && (
                        <button
                          onClick={() => onViewRollChain?.(call.rollChainId!)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
                          title="View roll history"
                        >
                          R{call.rollNumber || 1}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : `$${call.strike}`}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {call.contracts}
                    {call.originalContracts && (
                      <span className="ml-1 text-[10px] text-caution font-medium">
                        /{call.originalContracts}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {formatDateShort(call.expiration)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{call.dteAtEntry}d</td>
                  <td className="px-4 py-3 text-sm text-profit font-medium">
                    {formatCurrency(call.premiumCollected)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatCurrency(call.costBasis)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium',
                        call.status === 'open'
                          ? 'bg-blue-500/10 text-blue-400'
                          : call.status === 'called'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-muted/10 text-muted'
                      )}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm font-semibold',
                      call.status !== 'open'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {call.status !== 'open' ? (privacyMode ? '$***' : (pl >= 0 ? '+' : '') + formatCurrency(pl)) : '-'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-sm',
                      call.status !== 'open'
                        ? pl >= 0
                          ? 'text-profit'
                          : 'text-loss'
                        : 'text-muted'
                    )}
                  >
                    {call.status !== 'open' ? formatPercent(plPercent, 2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatDateShort(call.entryDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {call.exitDate ? formatDateShort(call.exitDate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {call.exitReason ? (
                      <span className="px-2 py-1 bg-background/50 rounded-lg text-muted text-xs">
                        {call.exitReason}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-3">
                      {call.status === 'open' && onEdit && (
                        <button
                          onClick={() => onEdit(call)}
                          className="text-muted hover:text-foreground text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {call.status === 'open' && onClose && (
                        <button
                          onClick={() => onClose(call)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                        >
                          Close
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(call)}
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

      {filteredAndSortedCalls.length === 0 && calls.length > 0 && (
        <div className="text-center py-8 text-muted">No covered calls match your filters</div>
      )}
    </div>
  );
}
