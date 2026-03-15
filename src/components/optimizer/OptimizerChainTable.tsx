'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { OptimizerRow } from '@/types';

interface OptimizerChainTableProps {
  chain: OptimizerRow[];
  costBasisPerShare: number;
  stockPrice: number;
  sortKey: keyof OptimizerRow;
  sortAsc: boolean;
  onSort: (key: keyof OptimizerRow) => void;
  onWriteCall: (row: OptimizerRow) => void;
  aiPickSymbol?: string;
  earningsMap?: Map<string, string | null>;
  ticker?: string | null;
  privacyMode: boolean;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Column {
  key: keyof OptimizerRow | '_monthlyPct';
  label: string;
  tip?: string;
  align?: string;
  format?: (v: number | null, row: OptimizerRow) => string;
}

function buildColumns(costBasisPerShare: number): Column[] {
  return [
  { key: 'strike', label: 'Strike', format: (v) => v != null ? `$${Number(v).toFixed(0)}` : '—' },
  { key: 'expiration', label: 'Exp' },
  { key: 'dte', label: 'DTE', tip: 'Days to expiration' },
  { key: 'midpoint', label: 'Mid', tip: 'Premium per share', format: (v) => v != null && Number(v) > 0 ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'delta', label: 'Delta', tip: '~Probability ITM', format: (v) => v != null ? Number(v).toFixed(3) : '—' },
  { key: 'iv', label: 'IV%', tip: 'Implied volatility', format: (v) => v != null ? (Number(v) * 100).toFixed(1) + '%' : '—' },
  { key: 'annualizedReturn', label: 'Ann %', tip: 'Annualized return on stock price', format: (v, row) => v == null || row.midpoint <= 0 ? '—' : Number(v).toFixed(1) + '%' },
  { key: '_monthlyPct', label: 'Mo%', tip: 'Monthly return on cost basis (premium / cost basis)', format: (_v, row) => {
    if (!costBasisPerShare || row.midpoint <= 0) return '—';
    return ((row.premiumPerShare / costBasisPerShare) * 100).toFixed(2) + '%';
  }},
  { key: 'distanceFromPrice', label: 'OTM%', tip: '% above current price', format: (v) => v != null ? Number(v).toFixed(1) + '%' : '—' },
  { key: 'calledAwayPL', label: 'If Called', tip: 'Net P/L if assigned at this strike', align: 'right', format: (v) => {
    if (v == null) return '—';
    const n = Number(v);
    return (n >= 0 ? '+' : '') + '$' + n.toFixed(0);
  }},
  { key: 'weeksToBreakeven', label: 'Wks BE', tip: 'Weeks of this premium to reach cost basis', format: (v) => {
    if (v == null) return '—';
    const n = Number(v);
    return n >= 999 || !isFinite(n) ? '∞' : n.toFixed(1);
  }},
  { key: 'openInterest', label: 'OI', tip: 'Open interest (liquidity)' },
  { key: 'volume', label: 'Vol' },
  ];
}

/** Filter out junk strikes that aren't real covered call candidates */
function isViableStrike(row: OptimizerRow, stockPrice: number): boolean {
  // Deep ITM (> 40% ITM) with no delta — intrinsic-value-only junk
  if (row.distanceFromPrice < -40 && row.delta === null) return false;
  // Strike is less than 30% of stock price — way too deep ITM
  if (row.strike < stockPrice * 0.3) return false;
  return true;
}

export function OptimizerChainTable({
  chain,
  costBasisPerShare,
  stockPrice,
  sortKey,
  sortAsc,
  onSort,
  onWriteCall,
  aiPickSymbol,
  earningsMap,
  ticker,
  privacyMode,
}: OptimizerChainTableProps) {
  // Resolve earnings date for this ticker
  const earningsDate = ticker ? earningsMap?.get(ticker) : undefined;
  const mask = (val: string) => privacyMode ? '***' : val;
  const columns = useMemo(() => buildColumns(costBasisPerShare), [costBasisPerShare]);

  // Filter to viable strikes
  const viableChain = useMemo(() =>
    chain.filter(row => isViableStrike(row, stockPrice)),
    [chain, stockPrice],
  );

  const junkCount = chain.length - viableChain.length;

  if (viableChain.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted">No viable options match the current filters. Try adjusting your parameters.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-foreground">Options Chain</h4>
          <span className="text-[10px] text-muted">{viableChain.length} strikes</span>
          {junkCount > 0 && (
            <span className="text-[10px] text-muted/40">{junkCount} illiquid hidden</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted/50">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/30" /> Profit if called</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500/30" /> AI pick</span>
          {earningsDate && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/30" /> Crosses earnings</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key === '_monthlyPct' ? 'premiumPerShare' : col.key as keyof OptimizerRow)}
                  title={col.tip}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium text-muted cursor-pointer hover:text-foreground transition-colors whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={cn(!sortAsc && 'rotate-180')}>
                        <path d="M4 1L7 6H1L4 1Z" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
              {earningsDate && (
                <th className="px-3 py-2.5 text-xs font-medium text-muted whitespace-nowrap" title="Earnings collision check">
                  Earn.
                </th>
              )}
              <th className="px-3 py-2.5 text-xs font-medium text-muted text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {viableChain.map((row) => {
              const isAIPick = row.symbol === aiPickSymbol;
              const calledPLPositive = row.calledAwayPL >= 0;
              const crossesEarnings = earningsDate
                ? new Date(row.expiration + 'T00:00:00') >= new Date(earningsDate + 'T00:00:00')
                : false;

              return (
                <tr
                  key={row.symbol}
                  className={cn(
                    'border-b border-border/50 hover:bg-card/50 transition-colors',
                    isAIPick && 'bg-purple-500/5 ring-1 ring-inset ring-purple-500/20',
                    calledPLPositive && !isAIPick && 'bg-emerald-500/5',
                    crossesEarnings && 'border-l-2 border-l-red-500/40',
                  )}
                >
                  {columns.map(col => {
                    const raw = col.key === '_monthlyPct' ? null : row[col.key as keyof OptimizerRow];
                    let display: string;
                    if (col.format) {
                      display = col.format(raw as number | null, row);
                    } else if (typeof raw === 'number') {
                      display = raw.toString();
                    } else {
                      display = String(raw ?? '—');
                    }

                    const isMasked = privacyMode && ['midpoint', 'calledAwayPL', 'annualizedReturn', '_monthlyPct', 'strike'].includes(col.key);

                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2 whitespace-nowrap',
                          col.align === 'right' ? 'text-right' : 'text-left',
                          col.key === 'calledAwayPL' && raw != null && (
                            Number(raw) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          ),
                          col.key === 'annualizedReturn' && 'text-blue-400 font-medium',
                          col.key === '_monthlyPct' && 'text-emerald-400 font-medium',
                        )}
                      >
                        {isAIPick && col.key === 'strike' && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold mr-1.5">
                            AI
                          </span>
                        )}
                        {isMasked ? mask(display) : display}
                      </td>
                    );
                  })}
                  {earningsDate && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {crossesEarnings ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20"
                          title={`Earnings ${earningsDate} — expiration crosses earnings`}
                        >
                          ER {formatShortDate(earningsDate)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-500/70" title={`Earnings ${earningsDate} — expires before`}>
                          Safe
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onWriteCall(row)}
                      className="px-2 py-1 rounded text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                    >
                      Write Call
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
