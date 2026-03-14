'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { OptimizerRow } from '@/types';

interface OptimizerRecoveryChartProps {
  chain: OptimizerRow[];
  costBasisPerShare: number;
  stockPrice: number;
  privacyMode: boolean;
}

const tooltipStyle = {
  contentStyle: { backgroundColor: 'rgba(24, 24, 27, 0.95)', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: '12px' },
  labelStyle: { color: '#fafafa', fontWeight: 600 },
  itemStyle: { color: '#fafafa' },
};

/** Filter to only viable OTM/ATM strikes with Greeks */
function viableStrikes(chain: OptimizerRow[], stockPrice: number): OptimizerRow[] {
  return chain.filter(r =>
    r.midpoint > 0 &&
    r.strike >= stockPrice * 0.3
  );
}

export function OptimizerRecoveryChart({ chain, costBasisPerShare, stockPrice, privacyMode }: OptimizerRecoveryChartProps) {
  const { chartData, gap, isThin } = useMemo(() => {
    const gapPerShare = costBasisPerShare - stockPrice;
    const viable = viableStrikes(chain, stockPrice);
    if (viable.length === 0) return { chartData: [], gap: gapPerShare, isThin: true };

    // Build per-strike comparison bars
    const data = viable.map(row => {
      const premiumPct = (row.premiumPerShare / stockPrice) * 100;
      const ifCalledPct = ((row.strike - costBasisPerShare + row.premiumPerShare) / costBasisPerShare) * 100;

      return {
        label: `$${row.strike}`,
        strike: row.strike,
        premium: row.premiumPerShare,
        premiumPct: +premiumPct.toFixed(2),
        ifCalledPct: +ifCalledPct.toFixed(2),
        delta: row.delta,
        dte: row.dte,
        annReturn: row.annualizedReturn,
        oi: row.openInterest,
        isAboveCB: row.strike >= costBasisPerShare,
      };
    });

    return { chartData: data, gap: gapPerShare, isThin: viable.length < 6 };
  }, [chain, costBasisPerShare, stockPrice]);

  // Don't render if no viable data
  if (chartData.length === 0) return null;

  // Near-breakeven: show a simpler summary instead of a chart
  const gap$ = Math.abs(costBasisPerShare - stockPrice);
  const isNearBreakeven = gap$ < costBasisPerShare * 0.05; // within 5%

  if (isNearBreakeven && chartData.length <= 5) {
    return (
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-foreground mb-1">Strike Comparison</h4>
        <p className="text-xs text-muted mb-3">
          Position is near breakeven ({privacyMode ? '***' : `$${gap$.toFixed(2)}`} gap) — any premium collected is profit.
        </p>
        <div className="space-y-2">
          {chartData.map((d) => {
            const pctFill = Math.min(100, (d.premiumPct / Math.max(...chartData.map(c => c.premiumPct))) * 100);
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-foreground w-10 text-right">{d.label}</span>
                <div className="flex-1 h-6 bg-zinc-800/40 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${d.isAboveCB ? 'bg-emerald-500/60' : 'bg-blue-500/50'}`}
                    style={{ width: `${pctFill}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-foreground">
                    {privacyMode ? '***' : `$${d.premium.toFixed(2)}`}
                    <span className="text-muted/60 ml-1.5">δ{d.delta?.toFixed(2)}</span>
                    <span className="text-muted/40 ml-1.5">{d.oi} OI</span>
                    {d.isAboveCB && <span className="ml-auto text-emerald-400 text-[9px]">above CB</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard chart: per-strike premium & called-away P/L comparison
  return (
    <div className="glass-card p-5">
      <h4 className="text-sm font-semibold text-foreground mb-1">Premium by Strike</h4>
      <p className="text-xs text-muted mb-4">
        Premium % of stock price per strike — {privacyMode ? '***' : `$${gap$.toFixed(2)}`} gap to breakeven
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickLine={false}
            tickFormatter={v => privacyMode ? '***' : `${v}%`}
          />
          <Tooltip
            {...tooltipStyle}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground">{d.label} Call ({d.dte} DTE)</p>
                  <p className="text-muted">Premium: {privacyMode ? '***' : `$${d.premium.toFixed(2)} (${d.premiumPct}%)`}</p>
                  <p className="text-muted">If called: {privacyMode ? '***' : `${d.ifCalledPct > 0 ? '+' : ''}${d.ifCalledPct}%`}</p>
                  <p className="text-muted">Delta: {d.delta?.toFixed(3) ?? '—'} | Ann: {d.annReturn?.toFixed(0)}%</p>
                  <p className="text-muted">OI: {d.oi}</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 4" />
          <Bar dataKey="premiumPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isAboveCB ? '#10b981' : '#3b82f6'} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
