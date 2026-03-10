'use client';

import { useFormatters } from '@/hooks/useFormatters';

interface FiftyTwoWeekBarProps {
  low: number;
  high: number;
  current: number;
}

export function FiftyTwoWeekBar({ low, high, current }: FiftyTwoWeekBarProps) {
  const { formatCurrency } = useFormatters();
  const range = high - low;
  const position = range > 0 ? Math.min(100, Math.max(0, ((current - low) / range) * 100)) : 50;

  return (
    <div className="w-full min-w-[80px]">
      <div className="relative h-1.5 bg-border/50 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent"
          style={{ left: `calc(${position}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted">{formatCurrency(low)}</span>
        <span className="text-[10px] text-muted">{formatCurrency(high)}</span>
      </div>
    </div>
  );
}
