'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { StockHolding, StockPrice } from '@/types';
import { useFormatters } from '@/hooks/useFormatters';
import { cn } from '@/lib/utils';

const PALETTE = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    border: '1px solid rgba(63, 63, 70, 0.5)',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: '#fafafa', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#fafafa' },
};

interface PortfolioDonutChartProps {
  holdings: StockHolding[];
  priceMap: Map<string, StockPrice>;
}

export function PortfolioDonutChart({ holdings, priceMap }: PortfolioDonutChartProps) {
  const { formatCurrency, formatPercent } = useFormatters();

  const { data, total } = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const h of holdings) {
      const sp = priceMap.get(h.ticker);
      if (!sp) continue;
      const mv = h.shares * sp.price;
      grouped.set(h.ticker, (grouped.get(h.ticker) ?? 0) + mv);
    }

    let entries = Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (entries.length > 8) {
      const top7 = entries.slice(0, 7);
      const otherValue = entries.slice(7).reduce((sum, e) => sum + e.value, 0);
      entries = [...top7, { name: 'Other', value: otherValue }];
    }

    const colored = entries.map((e, i) => ({ ...e, color: PALETTE[i % PALETTE.length] }));
    const total = colored.reduce((sum, d) => sum + d.value, 0);
    return { data: colored, total };
  }, [holdings, priceMap]);

  if (total === 0) return null;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative flex-shrink-0 w-[200px] h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data as any}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Pie>
            <Tooltip
              {...tooltipStyle}
              formatter={(v: any, name: any) => {
                const pct = ((Number(v) / total) * 100).toFixed(1);
                return [`${formatCurrency(Number(v))} (${pct}%)`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{formatCurrency(total)}</div>
            <div className="text-[10px] text-muted">Market Value</div>
          </div>
        </div>
      </div>

      {/* Breakdown list */}
      <div className="flex-1 w-full space-y-2">
        {data.map((entry) => {
          const pct = (entry.value / total) * 100;
          const sp = priceMap.get(entry.name);
          return (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-sm font-medium text-foreground w-12">{entry.name}</span>
              <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: entry.color, opacity: 0.75 }}
                />
              </div>
              <span className="text-xs text-muted w-10 text-right">{formatPercent(pct, 0)}</span>
              <span className="text-xs text-foreground w-20 text-right">{formatCurrency(entry.value)}</span>
              {sp && (
                <span className={cn('text-xs w-14 text-right', sp.changePercent >= 0 ? 'text-profit' : 'text-loss')}>
                  {sp.changePercent >= 0 ? '+' : ''}{sp.changePercent.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
