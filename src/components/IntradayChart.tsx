'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useIntradayData } from '@/hooks/useIntradayData';

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

interface IntradayChartProps {
  ticker: string;
  prevClose?: number;
}

export function IntradayChart({ ticker, prevClose }: IntradayChartProps) {
  const { bars, isLoading, error } = useIntradayData(ticker);

  if (isLoading) {
    return <div className="h-[200px] w-full bg-foreground/5 rounded-lg animate-pulse" />;
  }

  if (error || bars.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted text-sm">
        {bars.length === 0 ? 'No intraday data available' : 'Error loading intraday data'}
      </div>
    );
  }

  const data = bars.map((b) => ({
    time: new Date(b.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: b.c,
  }));

  const lastPrice = bars[bars.length - 1].c;
  const refPrice = prevClose ?? bars[0].o;
  const isUp = lastPrice >= refPrice;
  const color = isUp ? COLORS.profit : COLORS.loss;

  const prices = bars.map((b) => b.c);
  const minPrice = Math.min(...prices, refPrice);
  const maxPrice = Math.max(...prices, refPrice);
  const padding = (maxPrice - minPrice) * 0.1 || 1;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`intradayGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#71717a' }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tick={{ fontSize: 10, fill: '#71717a' }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            width={60}
            tickLine={false}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']}
          />
          {prevClose !== undefined && (
            <ReferenceLine
              y={prevClose}
              stroke="#71717a"
              strokeDasharray="4 4"
              label={{ value: 'Prev Close', position: 'right', fill: '#71717a', fontSize: 10 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            fill={`url(#intradayGrad-${ticker})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
