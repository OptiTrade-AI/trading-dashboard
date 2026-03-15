'use client';

import { cn } from '@/lib/utils';

interface OpportunityScoreBadgeProps {
  score: number | undefined | null;
  size?: 'sm' | 'md';
}

export function OpportunityScoreBadge({ score, size = 'sm' }: OpportunityScoreBadgeProps) {
  if (score == null) return <span className="text-muted text-xs">-</span>;

  const rounded = Math.round(score);
  const pct = Math.min(rounded, 100);

  const barColor =
    rounded >= 70
      ? 'bg-emerald-500'
      : rounded >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const textColor =
    rounded >= 70
      ? 'text-emerald-400'
      : rounded >= 50
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className={cn('flex items-center gap-2', size === 'md' ? 'min-w-[80px]' : 'min-w-[64px]')}>
      <span className={cn('font-bold tabular-nums', textColor, size === 'md' ? 'text-sm' : 'text-xs')}>
        {rounded}
      </span>
      <div className={cn('flex-1 rounded-full overflow-hidden', size === 'md' ? 'h-1.5' : 'h-1', 'bg-border/50')}>
        <div
          className={cn(
            barColor,
            'h-full rounded-full transition-all duration-500',
            rounded >= 85 && 'shadow-[0_0_6px] shadow-emerald-500/50',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
