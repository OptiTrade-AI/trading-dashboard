'use client';

import { useState, useMemo } from 'react';
import { StockHolding } from '@/types';
import { formatDateShort, cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

type SortKey = 'ticker' | 'shares' | 'costBasisPerShare' | 'acquiredDate' | 'totalCost';
type SortDirection = 'asc' | 'desc';

interface HoldingsTableProps {
  holdings: StockHolding[];
  onEdit?: (holding: StockHolding) => void;
  onDelete?: (holding: StockHolding) => void;
}

export function HoldingsTable({ holdings, onEdit, onDelete }: HoldingsTableProps) {
  const { formatCurrency, privacyMode } = useFormatters();
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterTicker, setFilterTicker] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...holdings];

    if (filterTicker) {
      result = result.filter(h => h.ticker.toLowerCase().includes(filterTicker.toLowerCase()));
    }

    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === 'totalCost') {
        aVal = a.shares * a.costBasisPerShare;
        bVal = b.shares * b.costBasisPerShare;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [holdings, filterTicker, sortKey, sortDirection]);

  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker)));

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
              <SortHeader label="Shares" sortKeyVal="shares" />
              <SortHeader label="Cost/Share" sortKeyVal="costBasisPerShare" />
              <SortHeader label="Total Cost" sortKeyVal="totalCost" />
              <SortHeader label="Acquired" sortKeyVal="acquiredDate" />
              <th className="px-4 py-3 text-left stat-label">Notes</th>
              <th className="px-4 py-3 text-right stat-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((holding) => {
              const totalCost = holding.shares * holding.costBasisPerShare;
              return (
                <tr key={holding.id} className="hover:bg-background/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <span className="text-blue-400 text-xs font-bold">{holding.ticker.slice(0, 2)}</span>
                      </div>
                      <span className="font-medium text-foreground">{holding.ticker}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '***' : holding.shares}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{privacyMode ? '$***' : formatCurrency(holding.costBasisPerShare)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{privacyMode ? '$***' : formatCurrency(totalCost)}</td>
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
