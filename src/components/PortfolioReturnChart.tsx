'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { StockHolding, StockPrice, AggBar } from '@/types';
import { cn } from '@/lib/utils';

const LINE_COLORS = [
  '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#8b5cf6', '#14b8a6', '#e879f9',
];

const SPY_COLOR = '#3b82f6';

const COLORS = {
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

const MAX_DEFAULT = 5;

interface PortfolioReturnChartProps {
  holdings: StockHolding[];
  priceMap: Map<string, StockPrice>;
  allBars: Map<string, AggBar[]>;
}

export function PortfolioReturnChart({ holdings, priceMap, allBars }: PortfolioReturnChartProps) {
  // All stock tickers (not SPY)
  const stockTickers = useMemo(() => {
    const set = new Set<string>();
    holdings.forEach((h) => set.add(h.ticker));
    return Array.from(set).filter((t) => t !== 'SPY').sort();
  }, [holdings]);

  // Rank tickers by market value, pick top 5 as default visible
  const defaultVisible = useMemo(() => {
    const mvMap = new Map<string, number>();
    for (const h of holdings) {
      const sp = priceMap.get(h.ticker);
      if (!sp) continue;
      mvMap.set(h.ticker, (mvMap.get(h.ticker) ?? 0) + h.shares * sp.price);
    }
    return Array.from(mvMap.entries())
      .filter(([t]) => t !== 'SPY')
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_DEFAULT)
      .map(([t]) => t);
  }, [holdings, priceMap]);

  const [visible, setVisible] = useState<Set<string> | null>(null);

  // Initialize from defaultVisible on first render after data loads
  const activeSet = useMemo(() => {
    if (visible !== null) return visible;
    return new Set(defaultVisible);
  }, [visible, defaultVisible]);

  const toggleTicker = (ticker: string) => {
    const next = new Set(activeSet);
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    setVisible(next);
  };

  const toggleAll = () => {
    if (activeSet.size === stockTickers.length) {
      setVisible(new Set(defaultVisible));
    } else {
      setVisible(new Set(stockTickers));
    }
  };

  // Stable color map: assign each ticker a consistent color
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    stockTickers.forEach((t, i) => map.set(t, LINE_COLORS[i % LINE_COLORS.length]));
    return map;
  }, [stockTickers]);

  // Chart data: compute return % for all tickers (even hidden ones, so toggling is instant)
  const data = useMemo(() => {
    if (allBars.size === 0 || stockTickers.length === 0) return [];

    let longestBars: AggBar[] = [];
    Array.from(allBars.entries()).forEach(([ticker, bars]) => {
      if (ticker === 'SPY') return;
      if (bars.length > longestBars.length) longestBars = bars;
    });

    if (longestBars.length === 0) return [];

    const tickerDateMap = new Map<string, Map<number, number>>();
    Array.from(allBars.entries()).forEach(([ticker, bars]) => {
      const dateMap = new Map<number, number>();
      for (const bar of bars) {
        dateMap.set(bar.t, bar.c);
      }
      tickerDateMap.set(ticker, dateMap);
    });

    const firstPrice = new Map<string, number>();
    const allTickers = [...stockTickers];
    if (allBars.has('SPY')) allTickers.push('SPY');

    const dates = longestBars.map((b) => b.t);
    const points: Record<string, any>[] = [];

    for (const ts of dates) {
      const point: Record<string, any> = {
        date: `${new Date(ts).getMonth() + 1}/${new Date(ts).getDate()}`,
      };

      for (const ticker of allTickers) {
        const price = tickerDateMap.get(ticker)?.get(ts);
        if (price === undefined) continue;

        if (!firstPrice.has(ticker)) firstPrice.set(ticker, price);
        const base = firstPrice.get(ticker)!;
        const returnPct = base > 0 ? ((price - base) / base) * 100 : 0;
        point[ticker] = Math.round(returnPct * 100) / 100;
      }

      points.push(point);
    }

    if (points.length > 60) {
      const step = Math.floor(points.length / 60);
      const thinned = points.filter((_, i) => i % step === 0);
      if (thinned[thinned.length - 1] !== points[points.length - 1]) {
        thinned.push(points[points.length - 1]);
      }
      return thinned;
    }

    return points;
  }, [stockTickers, allBars]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted">No data available</div>;
  }

  // Current return for each ticker (last data point)
  const lastPoint = data[data.length - 1];

  return (
    <div>
      {/* Ticker toggle chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          onClick={toggleAll}
          className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
            activeSet.size === stockTickers.length
              ? 'border-accent/50 bg-accent/10 text-accent'
              : 'border-border/50 text-muted hover:text-foreground'
          )}
        >
          {activeSet.size === stockTickers.length ? 'Top 5' : 'All'}
        </button>
        <div className="w-px h-4 bg-border/30 mx-1" />
        {/* SPY always on */}
        {allBars.has('SPY') && (
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-blue-500/40 bg-blue-500/10 text-blue-400"
          >
            SPY {lastPoint?.SPY !== undefined ? `${lastPoint.SPY > 0 ? '+' : ''}${lastPoint.SPY.toFixed(1)}%` : ''}
          </span>
        )}
        {stockTickers.map((ticker) => {
          const color = colorMap.get(ticker) ?? '#71717a';
          const isActive = activeSet.has(ticker);
          const ret = lastPoint?.[ticker];
          return (
            <button
              key={ticker}
              onClick={() => toggleTicker(ticker)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border',
                isActive
                  ? 'border-current/30'
                  : 'border-border/30 text-muted/40 hover:text-muted'
              )}
              style={isActive ? { color, borderColor: `${color}40`, backgroundColor: `${color}10` } : undefined}
            >
              {ticker}
              {isActive && ret !== undefined && (
                <span className="ml-1 opacity-70">{ret > 0 ? '+' : ''}{ret.toFixed(1)}%</span>
              )}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#71717a' }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#71717a' }}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
            width={50}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke="#71717a" strokeDasharray="4 4" />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: any, name: any) => [
              `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`,
              String(name),
            ]}
          />
          {/* Individual stock lines — only visible ones rendered */}
          {stockTickers
            .filter((t) => activeSet.has(t))
            .map((ticker) => (
              <Line
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stroke={colorMap.get(ticker)}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          {/* SPY benchmark — always visible */}
          {allBars.has('SPY') && (
            <Line
              type="monotone"
              dataKey="SPY"
              stroke={SPY_COLOR}
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
