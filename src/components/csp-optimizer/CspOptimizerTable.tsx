'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { CspOpportunity } from '@/types';
import type { TickerScoreHistory } from '@/app/api/screeners/csp/history/route';
import { cn } from '@/lib/utils';
import { OpportunityScoreBadge } from '@/components/screeners/OpportunityScoreBadge';

interface CspOptimizerTableProps {
  data: CspOpportunity[];
  selectedTickers: Set<string>;
  analyzingTickers: Set<string>;
  analyzedTickers: Set<string>;
  onToggleTicker: (ticker: string) => void;
  onWritePut: (opp: CspOpportunity) => void;
  earningsMap?: Map<string, string | null>;
  scoreHistoryMap?: Map<string, TickerScoreHistory>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return value.toLocaleString();
}

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function TrendIndicator({ history }: { history: TickerScoreHistory }) {
  if (history.trend === 'new') {
    return <span className="text-zinc-500 ml-1" title="New — first appearance">&bull;</span>;
  }
  if (history.trend === 'up') {
    return <span className="text-profit ml-1" title="Score improving">&uarr;</span>;
  }
  if (history.trend === 'down') {
    return <span className="text-loss ml-1" title="Score declining">&darr;</span>;
  }
  return <span className="text-zinc-500 ml-1" title="Score stable">&mdash;</span>;
}

function ScoreSparkline({ history, ticker }: { history: TickerScoreHistory; ticker: string }) {
  if (history.scores.length < 2) return null;

  const data = history.scores.map(s => ({ s: s.score }));
  const isUp = history.trend === 'up';
  const color = isUp ? '#10b981' : history.trend === 'down' ? '#ef4444' : '#71717a';
  const gradientId = `scoreGrad-${ticker}`;

  return (
    <div className="w-14 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="s"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const columnHelper = createColumnHelper<CspOpportunity>();

export function CspOptimizerTable({
  data,
  selectedTickers,
  analyzingTickers,
  analyzedTickers,
  onToggleTicker,
  onWritePut,
  earningsMap,
  scoreHistoryMap,
}: CspOptimizerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }]);

  const columns = useMemo(() => [
    // Checkbox column
    columnHelper.display({
      id: 'select',
      header: () => null,
      cell: ({ row }) => {
        const ticker = row.original.ticker;
        return (
          <input
            type="checkbox"
            checked={selectedTickers.has(ticker)}
            onChange={() => onToggleTicker(ticker)}
            className="rounded border-zinc-600 bg-zinc-800 text-accent focus:ring-accent cursor-pointer"
          />
        );
      },
      size: 40,
    }),
    // AI status
    columnHelper.display({
      id: 'aiStatus',
      header: 'AI',
      cell: ({ row }) => {
        const ticker = row.original.ticker;
        if (analyzingTickers.has(ticker)) {
          return (
            <svg className="animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          );
        }
        if (analyzedTickers.has(ticker)) {
          return <span className="text-profit text-sm">&#10003;</span>;
        }
        return null;
      },
      size: 40,
    }),
    // Score with trend
    columnHelper.accessor('score', {
      header: 'Score',
      cell: (info) => {
        const ticker = info.row.original.ticker;
        const history = scoreHistoryMap?.get(ticker);
        return (
          <div className="flex items-center gap-0.5 group relative">
            <OpportunityScoreBadge score={info.getValue()} />
            {history && <TrendIndicator history={history} />}
            {/* Sparkline tooltip on hover */}
            {history && history.scores.length >= 2 && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 shadow-xl">
                  <div className="text-[10px] text-muted mb-1">Score history ({history.scores.length} runs)</div>
                  <ScoreSparkline history={history} ticker={ticker} />
                  <div className="flex justify-between text-[9px] text-muted mt-0.5">
                    <span>{history.scores[0]?.score}</span>
                    <span>{history.scores[history.scores.length - 1]?.score}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
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
    // Earnings column
    columnHelper.display({
      id: 'earnings',
      header: 'Earn.',
      cell: ({ row }) => {
        if (!earningsMap) return null;
        const ticker = row.original.ticker;
        const earningsDate = earningsMap.get(ticker);
        if (earningsDate === undefined) return null; // still loading
        if (earningsDate === null) return null; // unknown

        const expDate = new Date(row.original.expiration + 'T00:00:00');
        const erDate = new Date(earningsDate + 'T00:00:00');

        if (expDate >= erDate) {
          // Expiration crosses earnings — danger
          return (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20"
              title={`Earnings ${earningsDate} — expiration crosses earnings`}
            >
              ER {formatShortDate(earningsDate)}
            </span>
          );
        }

        // Safe — expires before earnings
        return (
          <span className="text-[10px] text-emerald-500/70" title={`Earnings ${earningsDate} — expires before`}>
            Safe
          </span>
        );
      },
      size: 70,
    }),
    columnHelper.accessor('delta', {
      header: 'Delta',
      cell: (info) => Math.abs(info.getValue()).toFixed(2),
      sortingFn: 'basic',
    }),
    columnHelper.accessor('premium', {
      header: 'Premium',
      cell: (info) => formatCurrency(info.getValue()),
      sortingFn: 'basic',
    }),
    columnHelper.accessor('return_on_risk_pct', {
      header: 'ROR%',
      cell: (info) => <span className="text-profit">{info.getValue().toFixed(1)}%</span>,
      sortingFn: 'basic',
    }),
    columnHelper.accessor('annualized_ror_pct', {
      header: 'Ann. ROR%',
      cell: (info) => <span className="text-profit">{info.getValue().toFixed(0)}%</span>,
      sortingFn: 'basic',
    }),
    columnHelper.accessor('probability_of_profit', {
      header: 'PoP%',
      cell: (info) => {
        const pop = info.getValue();
        return <span className={cn(pop >= 70 ? 'text-profit' : pop >= 60 ? 'text-caution' : 'text-loss')}>{pop.toFixed(0)}%</span>;
      },
      sortingFn: 'basic',
    }),
    columnHelper.accessor('implied_volatility', {
      header: 'IV%',
      cell: (info) => `${(info.getValue() * 100).toFixed(0)}%`,
      sortingFn: 'basic',
    }),
    columnHelper.accessor('open_interest', {
      header: 'OI',
      cell: (info) => new Intl.NumberFormat('en-US').format(info.getValue()),
      sortingFn: 'basic',
    }),
    columnHelper.accessor('market_cap', {
      header: 'Mkt Cap',
      cell: (info) => formatMarketCap(info.getValue()),
      sortingFn: 'basic',
    }),
    // Write Put action
    columnHelper.display({
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onWritePut(row.original); }}
          className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors whitespace-nowrap"
        >
          Write Put
        </button>
      ),
      size: 80,
    }),
  ], [selectedTickers, analyzingTickers, analyzedTickers, onToggleTicker, onWritePut, earningsMap, scoreHistoryMap]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        No opportunities match your filters. Try adjusting or selecting a different preset.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-zinc-800">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={cn(
                      'px-2 py-2 text-left text-muted font-medium whitespace-nowrap',
                      header.column.getCanSort() && 'cursor-pointer hover:text-foreground select-none',
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' \u2191' : header.column.getIsSorted() === 'desc' ? ' \u2193' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              // Check if earnings crosses expiration for row accent
              const ticker = row.original.ticker;
              const earningsDate = earningsMap?.get(ticker);
              const crossesEarnings = earningsDate
                ? new Date(row.original.expiration + 'T00:00:00') >= new Date(earningsDate + 'T00:00:00')
                : false;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors',
                    selectedTickers.has(ticker) && 'bg-accent/5',
                    crossesEarnings && 'border-l-2 border-l-red-500/40',
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-2 py-2 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
