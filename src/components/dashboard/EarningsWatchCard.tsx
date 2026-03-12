'use client';

import { useState } from 'react';
import { useEarningsWatch } from '@/hooks/useEarningsWatch';
import { cn } from '@/lib/utils';

const urgencyStyles = {
  high: { bg: 'bg-loss/10', border: 'border-loss/30', text: 'text-loss', dot: 'bg-loss' },
  medium: { bg: 'bg-caution/10', border: 'border-caution/30', text: 'text-caution', dot: 'bg-caution' },
  low: { bg: 'bg-accent/10', border: 'border-accent/30', text: 'text-accent', dot: 'bg-accent' },
};

export function EarningsWatchCard() {
  const { events, available, isLoading } = useEarningsWatch();
  const [expanded, setExpanded] = useState(false);

  if (!available || isLoading) return null;
  if (events.length === 0) return null;

  const highCount = events.filter(e => e.urgency === 'high').length;

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-caution" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01M4.93 19h14.14c1.1 0 1.79-1.19 1.24-2.14l-7.07-12.25a1.41 1.41 0 0 0-2.48 0L3.69 16.86C3.14 17.81 3.83 19 4.93 19z" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">
            Earnings Watch
          </h3>
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded-full',
            highCount > 0 ? 'bg-loss/15 text-loss' : 'bg-caution/15 text-caution'
          )}>
            {events.length}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={cn('text-muted transition-transform', expanded && 'rotate-180')}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {events.map((event, i) => {
            const style = urgencyStyles[event.urgency];
            return (
              <div
                key={`${event.ticker}-${i}`}
                className={cn('rounded-lg border p-3', style.bg, style.border)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-bold', style.text)}>{event.ticker}</span>
                  <span className="text-xs text-muted capitalize">{event.eventType}</span>
                  {event.eventDate !== 'unknown' && (
                    <span className="text-xs text-muted ml-auto">{event.eventDate}</span>
                  )}
                </div>
                <p className="text-xs text-foreground/70">{event.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
