'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import type { PcsOpportunity } from '@/types';
import { cn } from '@/lib/utils';

interface PcsTableProps {
  data: PcsOpportunity[];
}

const columnHelper = createColumnHelper<PcsOpportunity>();

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

const columns = [
  columnHelper.accessor('score', {
    header: 'Score',
    cell: (info) => {
      const score = info.getValue();
      if (score == null) return <span className="text-muted">-</span>;
      const rounded = Math.round(score);
      let colorClass = 'bg-red-500/20 text-red-400';
      if (score >= 70) colorClass = 'bg-emerald-500/20 text-emerald-400';
      else if (score >= 50) colorClass = 'bg-yellow-500/20 text-yellow-400';
      return (
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold', colorClass)}>
          {rounded}
        </span>
      );
    },
    sortingFn: 'basic',
  }),
  columnHelper.accessor('ticker', {
    header: 'Ticker',
    cell: (info) => (
      <span className="font-bold font-mono text-foreground">{info.getValue()}</span>
    ),
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('current_price', {
    header: 'Price',
    cell: (info) => formatCurrency(info.getValue()),
    enableSorting: false,
  }),
  columnHelper.accessor('short_strike', {
    header: 'Short Strike',
    cell: (info) => formatCurrency(info.getValue()),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('long_strike', {
    header: 'Long Strike',
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
  columnHelper.accessor('delta', {
    header: 'Delta',
    cell: (info) => Math.abs(info.getValue()).toFixed(2),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('max_profit', {
    header: 'Max Profit',
    cell: (info) => (
      <span className="text-profit">{formatCurrency(info.getValue())}</span>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('max_loss', {
    header: 'Max Loss',
    cell: (info) => (
      <span className="text-loss">{formatCurrency(info.getValue())}</span>
    ),
    sortingFn: 'basic',
  }),
  columnHelper.accessor('return_on_risk_pct', {
    header: 'ROR%',
    cell: (info) => (
      <span className="text-profit font-medium">{info.getValue().toFixed(2)}%</span>
    ),
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

export function PcsTable({ data }: PcsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'return_on_risk_pct', desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/30">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground transition-colors'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && (
                        <span className="text-accent">&#9650;</span>
                      )}
                      {header.column.getIsSorted() === 'desc' && (
                        <span className="text-accent">&#9660;</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/10 transition-colors hover:bg-card/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
        <span className="text-xs text-muted">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          {' '}({data.length} rows)
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
  );
}
