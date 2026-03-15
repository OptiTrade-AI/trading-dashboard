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
import type { ChartSetup, SlopeData, ScreenerFilters } from '@/types';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function SlopeArrow({ slope }: { slope: SlopeData }) {
  const trend = slope.trend;
  if (trend === 'strong_upward' || trend === 'moderate_upward') {
    const isStrong = trend === 'strong_upward';
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', 'bg-emerald-500/20 text-emerald-400')}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={isStrong ? 'M2 10L10 2' : 'M2 8L10 4'} />
          <path d={isStrong ? 'M6 2H10V6' : 'M6 4H10V7'} />
        </svg>
        {isStrong ? 'Strong Up' : 'Up'}
      </span>
    );
  }
  if (trend === 'strong_downward' || trend === 'moderate_downward') {
    const isStrong = trend === 'strong_downward';
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', 'bg-red-500/20 text-red-400')}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={isStrong ? 'M2 2L10 10' : 'M2 4L10 8'} />
          <path d={isStrong ? 'M6 10H10V6' : 'M6 8H10V5'} />
        </svg>
        {isStrong ? 'Strong Down' : 'Down'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-500/20 text-zinc-400">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 6H10" />
      </svg>
      Flat
    </span>
  );
}

const SLOPE_ORDER: Record<string, number> = {
  strong_upward: 2, moderate_upward: 1, flat: 0, moderate_downward: -1, strong_downward: -2,
};

const columnHelper = createColumnHelper<ChartSetup>();

const columns = [
  columnHelper.accessor('ticker', {
    header: 'Ticker',
    cell: (info) => <span className="font-bold font-mono text-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('company_name', {
    header: 'Company',
    cell: (info) => <span className="truncate max-w-[140px] inline-block text-muted" title={info.getValue()}>{info.getValue()}</span>,
    enableSorting: false,
  }),
  columnHelper.accessor('current_close', {
    header: 'Price',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('percent_below_sma_200', {
    header: '% Below SMA 200',
    cell: (info) => {
      const val = info.getValue();
      return <span className={cn('font-medium', val > 0 ? 'text-loss' : 'text-profit')}>{val.toFixed(2)}%</span>;
    },
  }),
  columnHelper.accessor('percent_above_ema_9', {
    header: '% Above EMA 9',
    cell: (info) => {
      const val = info.getValue();
      return <span className={cn('font-medium', val >= 0 ? 'text-profit' : 'text-loss')}>{val.toFixed(2)}%</span>;
    },
  }),
  columnHelper.accessor('sma_200_slope', {
    header: 'SMA 200',
    cell: (info) => <SlopeArrow slope={info.getValue()} />,
    sortingFn: (rowA, rowB) => (SLOPE_ORDER[rowA.original.sma_200_slope.trend] ?? 0) - (SLOPE_ORDER[rowB.original.sma_200_slope.trend] ?? 0),
  }),
  columnHelper.accessor('ema_9_slope', {
    header: 'EMA 9',
    cell: (info) => <SlopeArrow slope={info.getValue()} />,
    sortingFn: (rowA, rowB) => (SLOPE_ORDER[rowA.original.ema_9_slope.trend] ?? 0) - (SLOPE_ORDER[rowB.original.ema_9_slope.trend] ?? 0),
  }),
  columnHelper.accessor('ema_21_slope', {
    header: 'EMA 21',
    cell: (info) => <SlopeArrow slope={info.getValue()} />,
    sortingFn: (rowA, rowB) => (SLOPE_ORDER[rowA.original.ema_21_slope.trend] ?? 0) - (SLOPE_ORDER[rowB.original.ema_21_slope.trend] ?? 0),
  }),
  columnHelper.accessor('industry', {
    header: 'Industry',
    cell: (info) => <span className="truncate max-w-[120px] inline-block text-muted" title={info.getValue()}>{info.getValue()}</span>,
    enableSorting: false,
  }),
];

interface ChartSetupsResultsViewProps {
  data: ChartSetup[];
  filters: ScreenerFilters;
}

export function ChartSetupsResultsView({ data, filters }: ChartSetupsResultsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'percent_below_sma_200', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const filtered = useMemo(() => {
    return data.filter((setup) => {
      if (filters.tickerSearch && !setup.ticker.includes(filters.tickerSearch)) return false;
      if (filters.slopeDirection !== 'any') {
        const smaSlope = setup.sma_200_slope.trend;
        if (filters.slopeDirection === 'upward' && !smaSlope.includes('upward')) return false;
        if (filters.slopeDirection === 'downward' && !smaSlope.includes('downward')) return false;
        if (filters.slopeDirection === 'flat' && smaSlope !== 'flat') return false;
      }
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
      <p className="text-xs text-muted">{filtered.length} of {data.length} setups</p>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card-solid">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border/30">
                  {hg.headers.map((header) => (
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
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const setup = row.original;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className="border-b border-border/10 transition-colors cursor-pointer hover:bg-card/50"
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap text-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr key={`${row.id}-expanded`} className="border-b border-border/10">
                        <td colSpan={columns.length} className="px-4 py-4 bg-card-solid/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">SMA 200</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(setup.sma_200)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">EMA 9</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(setup.ema_9)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted uppercase tracking-wider">EMA 21</p>
                              <p className="text-sm font-medium text-foreground">{formatCurrency(setup.ema_21)}</p>
                            </div>
                            {setup.percent_above_ema_21 != null && (
                              <div>
                                <p className="text-[11px] text-muted uppercase tracking-wider">% Above EMA 21</p>
                                <p className={cn('text-sm font-medium', setup.percent_above_ema_21 >= 0 ? 'text-profit' : 'text-loss')}>
                                  {setup.percent_above_ema_21.toFixed(2)}%
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Price-to-MA bar */}
                          <div className="mt-3">
                            <p className="text-[11px] text-muted uppercase tracking-wider mb-1">Price vs Moving Averages</p>
                            <div className="relative h-2 bg-border/30 rounded-full overflow-hidden">
                              {(() => {
                                const vals = [setup.current_close, setup.sma_200, setup.ema_9, setup.ema_21];
                                const low = Math.min(...vals) * 0.98;
                                const high = Math.max(...vals) * 1.02;
                                const range = high - low;
                                const pos = (v: number) => ((v - low) / range) * 100;
                                return (
                                  <>
                                    <div className="absolute top-0 h-full w-1 bg-blue-400 rounded-full" style={{ left: `${pos(setup.sma_200)}%` }} title={`SMA 200: ${formatCurrency(setup.sma_200)}`} />
                                    <div className="absolute top-0 h-full w-1 bg-amber-400 rounded-full" style={{ left: `${pos(setup.ema_9)}%` }} title={`EMA 9: ${formatCurrency(setup.ema_9)}`} />
                                    <div className="absolute top-0 h-full w-1 bg-purple-400 rounded-full" style={{ left: `${pos(setup.ema_21)}%` }} title={`EMA 21: ${formatCurrency(setup.ema_21)}`} />
                                    <div className="absolute top-0 h-full w-1.5 bg-emerald-400 rounded-full" style={{ left: `${pos(setup.current_close)}%` }} title={`Price: ${formatCurrency(setup.current_close)}`} />
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex gap-3 mt-1 text-[10px]">
                              <span className="text-blue-400">SMA 200</span>
                              <span className="text-amber-400">EMA 9</span>
                              <span className="text-purple-400">EMA 21</span>
                              <span className="text-emerald-400">Price</span>
                            </div>
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
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card-solid border border-border text-foreground disabled:opacity-40 hover:bg-zinc-700 transition-colors" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card-solid border border-border text-foreground disabled:opacity-40 hover:bg-zinc-700 transition-colors" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
