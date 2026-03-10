'use client';

import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AggBar } from '@/types';

interface TickerSparklineProps {
  bars: AggBar[] | undefined;
  ticker: string;
}

export function TickerSparkline({ bars, ticker }: TickerSparklineProps) {
  if (!bars || bars.length === 0) {
    return <span className="text-muted text-xs">—</span>;
  }

  const isUp = bars[bars.length - 1].c >= bars[0].c;
  const color = isUp ? '#10b981' : '#ef4444';
  const gradientId = `sparkGrad-${ticker}`;

  const data = bars.map((b) => ({ c: b.c }));

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="c"
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
