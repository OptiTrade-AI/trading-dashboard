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
import type { PcsOpportunity, ScreenerFilters } from '@/types';
import { cn } from '@/lib/utils';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { QuickTradeButton } from './QuickTradeButton';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

const columnHelper = createColumnHelper<PcsOpportunity>();

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
  columnHelper.accessor('short_strike', {
    header: 'Short',
    cell: (info) => formatCurrency(info.getValue()),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('long_strike', {
    header: 'Long',
    cell: (info) => formatCurrency(info.getValue()),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('spread_width', {
    header: 'Width',
    cell: (info) => `$${info.getValue().toFixed(0)}`,
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
  columnHelper.accessor('max_profit', {
    header: 'Max Profit',
    cell: (info) => <span className="text-profit">{formatCurrency(info.getValue())}</span>,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('max_loss', {
    header: 'Max Loss',
    cell: (info) => <span className="text-loss">{formatCurrency(info.getValue())}</span>,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('return_on_risk_pct', {
    header: 'ROR%',
    cell: (info) => <span className="text-profit font-medium">{info.getValue().toFixed(2)}%</span>,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('implied_volatility', {
    header: 'IV%',
    cell: (info) => `${(info.getValue() * 100).toFixed(1)}%`,
    sortingFn: 'basic',
  }),
  columnHelper.accessor('probability_of_profit', {
    header: 'PoP',
    cell: (info) => `${(info.getValue() * 100).toFixed(1)}%`,
    enableSorting: false,
  }),
];

interface PcsResultsViewProps {
  data: PcsOpportunity[];
  filters: ScreenerFilters;
  onTradeClick?: (opp: PcsOpportunity) => void;
}

export function PcsResultsView({ data, filters, onTradeClick }: PcsResultsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'return_on_risk_pct', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const filtered = useMemo(() => {
    return data.filter((opp) => {
      if (filters.tickerSearch && !opp.ticker.includes(filters.tickerSearch)) return false;
      const absDelta = Math.abs(opp.delta);
      if (absDelta < filters.minDelta || absDelta > filters.maxDelta) return false;
      if (opp.dte < filters.minDte || opp.dte > filters.maxDte) return false;
      if (opp.return_on_risk_pct < filters.minRor) return false;
      if (opp.implied_volatility * 100 < filters.minIv) return false;
      if (opp.open_interest < filters.minOi) return false;
      if ((opp.score ?? 0) < filters.minScore) return false;
      if (filters.maxSpreadWidth < 999 && opp.spread_width > filters.maxSpreadWidth) return false;
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
                  {onTradeClick && <th className="px-3 py-3 w-[80px]" />}
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
                        'border-b border-border/10 transition-colors cursor-pointer hover:bg-card/50',
                        score >= 80 && 'border-l-2 border-l-purple-500/40',
                      )}
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap text-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                      {onTradeClick && (
                        <td className="px-3 py-2.5">
                          <QuickTradeButton onClick={() => onTradeClick(opp)} />
                        </td>
                      )}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr key={`${row.id}-expanded`} className="border-b border-border/10">
                        <td colSpan={columns.length + (onTradeClick ? 1 : 0)} className="px-4 py-4 bg-card-solid/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Delta</p>
                              <p className="text-sm font-medium text-foreground">{Math.abs(opp.delta).toFixed(3)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Premium</p>
                              <p className="text-sm font-medium text-profit">{formatCurrency(opp.premium)}</p>
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
                              <p className="text-[11px] text-muted uppercase tracking-wider">Ann. ROR%</p>
                              <p className="text-sm font-medium text-profit">{opp.annualized_ror_pct.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Expiration</p>
                              <p className="text-sm font-medium text-foreground">{opp.expiration}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">Sector</p>
                              <p className="text-sm font-medium text-foreground">{opp.sector}</p>
                            </div>
                          </div>
                          {onTradeClick && (
                            <div className="mt-3">
                              <QuickTradeButton onClick={() => onTradeClick(opp)} label="Trade This Spread" size="md" />
                            </div>
                          )}
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
