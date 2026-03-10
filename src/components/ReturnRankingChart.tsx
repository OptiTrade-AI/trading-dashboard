'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { StockHolding, StockPrice } from '@/types';
import { useFormatters } from '@/hooks/useFormatters';

const COLORS = {
  profit: '#10b981',
  loss: '#ef4444',
  grid: 'rgba(63, 63, 70, 0.3)',
  tooltipBg: 'rgba(24, 24, 27, 0.95)',
  tooltipBorder: 'rgba(63, 63, 70, 0.5)',
  tooltipText: '#fafafa',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: COLORS.tooltipBg,
    border: `1px solid ${COLORS.tooltipBorder}`,
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: COLORS.tooltipText, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: COLORS.tooltipText },
};

interface ReturnRankingChartProps {
  holdings: StockHolding[];
  priceMap: Map<string, StockPrice>;
}

export function ReturnRankingChart({ holdings, priceMap }: ReturnRankingChartProps) {
  const { formatCurrency, privacyMode } = useFormatters();

  const data = useMemo(() => {
    // Group holdings by ticker: weighted avg cost basis
    const grouped = new Map<string, { totalCost: number; totalShares: number }>();
    for (const h of holdings) {
      const existing = grouped.get(h.ticker) ?? { totalCost: 0, totalShares: 0 };
      existing.totalCost += h.shares * h.costBasisPerShare;
      existing.totalShares += h.shares;
      grouped.set(h.ticker, existing);
    }

    const entries: { ticker: string; returnPct: number; pl: number }[] = [];
    for (const [ticker, { totalCost, totalShares }] of Array.from(grouped.entries())) {
      const sp = priceMap.get(ticker);
      if (!sp || totalCost === 0) continue;
      const marketValue = totalShares * sp.price;
      const pl = marketValue - totalCost;
      const returnPct = (pl / totalCost) * 100;
      entries.push({ ticker, returnPct: Math.round(returnPct * 100) / 100, pl });
    }

    // Sort by return % descending
    entries.sort((a, b) => b.returnPct - a.returnPct);
    return entries;
  }, [holdings, priceMap]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted">No price data available</div>;
  }

  const barHeight = Math.max(300, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={barHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: '#71717a' }}
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ticker"
          tick={{ fontSize: 12, fill: '#fafafa', fontWeight: 500 }}
          width={50}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: any, _name: any, props: any) => {
            const pct = `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
            const plVal = privacyMode ? '$***' : formatCurrency(props.payload.pl);
            return [`${pct} (${plVal})`, 'Return'];
          }}
        />
        <Bar dataKey="returnPct" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.returnPct >= 0 ? COLORS.profit : COLORS.loss}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
