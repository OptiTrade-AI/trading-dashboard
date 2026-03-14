'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { OptimizerRow } from '@/types';

interface OptimizerScatterChartProps {
  chain: OptimizerRow[];
  costBasisPerShare: number;
  privacyMode: boolean;
}

/** Only show strikes that have real Greeks data */
function viableStrikes(chain: OptimizerRow[]): OptimizerRow[] {
  return chain.filter(r => r.midpoint > 0);
}

export function OptimizerScatterChart({ chain, costBasisPerShare, privacyMode }: OptimizerScatterChartProps) {
  const chartData = useMemo(() => {
    const viable = viableStrikes(chain);
    if (viable.length < 2) return [];

    return viable.map(row => {
      const calledPLPerShare = row.strike - costBasisPerShare + row.premiumPerShare;
      return {
        label: `$${row.strike}`,
        strike: row.strike,
        delta: row.delta != null ? Math.abs(row.delta) : 0,
        premium: row.premiumPerShare,
        calledPL: calledPLPerShare,
        calledPLTotal: row.calledAwayPL,
        isProfit: calledPLPerShare >= 0,
        oi: row.openInterest,
        dte: row.dte,
        exp: row.expiration,
      };
    });
  }, [chain, costBasisPerShare]);

  if (chartData.length < 2) return null;

  return (
    <div className="glass-card p-5">
      <h4 className="text-sm font-semibold text-foreground mb-1">Delta vs. If-Called P/L</h4>
      <p className="text-xs text-muted mb-4">
        Higher delta = more premium but more assignment risk. Green bars = profit if called away.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickLine={false}
            tickFormatter={v => privacyMode ? '***' : `$${v}`}
            label={{ value: 'P/L per share if called', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 10, offset: 10 }}
          />
          <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 4" />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground">{d.label} Call ({d.exp})</p>
                  <p className="text-muted">Delta: {d.delta.toFixed(3)}</p>
                  <p className="text-muted">Premium: {privacyMode ? '***' : `$${d.premium.toFixed(2)}/sh`}</p>
                  <p className={d.isProfit ? 'text-emerald-400' : 'text-red-400'}>
                    If called: {privacyMode ? '***' : `${d.calledPL >= 0 ? '+' : ''}$${d.calledPL.toFixed(2)}/sh (${d.calledPL >= 0 ? '+' : ''}$${d.calledPLTotal.toFixed(0)} total)`}
                  </p>
                  <p className="text-muted">OI: {d.oi}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="calledPL" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isProfit ? '#10b981' : '#ef4444'} fillOpacity={0.65} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
