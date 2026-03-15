'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table';
import type { CspOpportunity, ScreenerFilters } from '@/types';
import { cn } from '@/lib/utils';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { QuickTradeButton } from './QuickTradeButton';

const MARKET_CAP_VALUES: Record<string, number> = {
  any: 0, '500M': 500_000_000, '1B': 1_000_000_000, '4B': 4_000_000_000,
  '10B': 10_000_000_000, '50B': 50_000_000_000,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return value.toLocaleString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

const columnHelper = createColumnHelper<CspOpportunity>();

const columns = [
  columnHelper.accessor('score', {
    header: 'Score',
    cell: (info) => <OpportunityScoreBadge score={info.getValue()} />,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('ticker', {
    header: 'Ticker',
    cell: (info) => <span className="font-bold font-mono text-foreground">{info.getValue()}</span>,
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('current_price', {
    header: 'Price',
    cell: (info) => formatCurrency(info.getValue()),
    enableSorting: false,
  }),
  columnHelper.accessor('strike', {
    header: 'Strike',
    cell: (info) => formatCurrency(info.getValue()),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('dte', {
    header: 'DTE',
    cell: (info) => {
      const dte = info.getValue();
      let colorClass = 'text-emerald-400';
      if (dte <= 7) colorClass = 'text-red-400';
      else if (dte <= 14) colorClass = 'text-yellow-400';
      return <span className={cn('font-medium', colorClass)}>{dte}</span>;
    },
    sortingFn: 'basic',
  }),
  columnHelper.accessor('delta', {
    header: 'Delta',
    cell: (info) => Math.abs(info.getValue()).toFixed(2),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('premium', {
    header: 'Premium',
    cell: (info) => <span className="text-profit">{formatCurrency(info.getValue())}</span>,
    enableSorting: false,
  }),
  columnHelper.accessor('implied_volatility', {
    header: 'IV%',
    cell: (info) => `${(info.getValue() * 100).toFixed(1)}%`,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('return_on_risk_pct', {
    header: 'ROR%',
    cell: (info) => <span className="text-profit font-medium">{info.getValue().toFixed(2)}%</span>,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('annualized_ror_pct', {
    header: 'Ann. ROR%',
    cell: (info) => `${info.getValue().toFixed(1)}%`,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('probability_of_profit', {
    header: 'PoP',
    cell: (info) => `${(info.getValue() * 100).toFixed(1)}%`,
    enableSorting: false,
  }),
];

interface CspResultsViewProps {
  data: CspOpportunity[];
  filters: ScreenerFilters;
  onTradeClick: (opp: CspOpportunity) => void;
}

export function CspResultsView({ data, filters, onTradeClick }: CspResultsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const filtered = useMemo(() => {
    const minCap = MARKET_CAP_VALUES[filters.minMarketCap] ?? 0;
    return data.filter((opp) => {
      if (filters.tickerSearch && !opp.ticker.includes(filters.tickerSearch)) return false;
      const absDelta = Math.abs(opp.delta);
      if (absDelta < filters.minDelta || absDelta > filters.maxDelta) return false;
      if (opp.dte < filters.minDte || opp.dte > filters.maxDte) return false;
      if (opp.return_on_risk_pct < filters.minRor) return false;
      if (opp.implied_volatility * 100 < filters.minIv) return false;
      if (opp.open_interest < filters.minOi) return false;
      if ((opp.score ?? 0) < filters.minScore) return false;
      if (minCap > 0 && opp.market_cap < minCap) return false;
      if (filters.sector !== 'all' && opp.sector !== filters.sector) return false;
      return true;
    });
  }, [data, filters]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Showing {filtered.length} of {data.length} opportunities
      </p>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card-solid">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/30">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        'px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <span className="text-accent">&#9650;</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-accent">&#9660;</span>}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 w-[80px]" />
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const opp = row.original;
                const score = opp.score ?? 0;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={cn(
                        'border-b border-border/10 transition-colors cursor-pointer',
                        'hover:bg-card/50',
                        score >= 80 && 'border-l-2 border-l-emerald-500/40',
                      )}
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap text-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <QuickTradeButton onClick={() => onTradeClick(opp)} />
                      </td>
                    </tr>
                    {row.getIsExpanded() && (
                      <tr key={`${row.id}-expanded`} className="border-b border-border/10">
                        <td colSpan={columns.length + 1} className="px-4 py-4 bg-card-solid/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Bid / Ask</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(opp.bid)} / {formatCurrency(opp.ask)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Open Interest</p>
                              <p className="text-sm font-medium text-foreground">{formatNumber(opp.open_interest)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Volume</p>
                              <p className="text-sm font-medium text-foreground">{formatNumber(opp.volume)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Break Even</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(opp.break_even)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Collateral</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(opp.cash_collateral)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Mkt Cap</p>
                              <p className="text-sm font-medium text-foreground">{formatMarketCap(opp.market_cap)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Sector</p>
                              <p className="text-sm font-medium text-foreground">{opp.sector}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Ann. ROC%</p>
                              <p className="text-sm font-medium text-profit">{opp.annualized_roc_pct.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Expiration</p>
                              <p className="text-sm font-medium text-foreground">{opp.expiration}</p>
                            </div>
                          </div>
                          {/* Break-even visualization */}
                          <div className="mt-4">
                            <p className="text-[11px] text-muted uppercase tracking-wider mb-1.5">Price Position</p>
                            <div className="relative h-2 bg-border/30 rounded-full overflow-hidden">
                              {(() => {
                                const low = Math.min(opp.break_even, opp.current_price, opp.strike) * 0.98;
                                const high = Math.max(opp.break_even, opp.current_price, opp.strike) * 1.02;
                                const range = high - low;
                                const bePct = ((opp.break_even - low) / range) * 100;
                                const pricePct = ((opp.current_price - low) / range) * 100;
                                const strikePct = ((opp.strike - low) / range) * 100;
                                return (
                                  <>
                                    <div className="absolute top-0 h-full w-1 bg-red-400 rounded-full" style={{ left: `${bePct}%` }} title={`Break Even: ${formatCurrency(opp.break_even)}`} />
                                    <div className="absolute top-0 h-full w-1 bg-amber-400 rounded-full" style={{ left: `${strikePct}%` }} title={`Strike: ${formatCurrency(opp.strike)}`} />
                                    <div className="absolute top-0 h-full w-1.5 bg-emerald-400 rounded-full" style={{ left: `${pricePct}%` }} title={`Price: ${formatCurrency(opp.current_price)}`} />
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-muted">
                              <span className="text-red-400">BE {formatCurrency(opp.break_even)}</span>
                              <span className="text-amber-400">Strike {formatCurrency(opp.strike)}</span>
                              <span className="text-emerald-400">Price {formatCurrency(opp.current_price)}</span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <QuickTradeButton onClick={() => onTradeClick(opp)} label="Trade This" size="md" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
          <span className="text-xs text-muted">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({filtered.length} rows)
          </span>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card-solid border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </button>
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card-solid border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
