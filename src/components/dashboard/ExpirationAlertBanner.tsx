'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { OpenPosition } from './PositionsTimeline';

const typeToPage: Record<string, string> = {
  csp: '/log',
  cc: '/cc',
  directional: '/directional',
  spread: '/spreads',
};

export function ExpirationAlertBanner({ positions }: { positions: OpenPosition[] }) {
  const [dismissed, setDismissed] = useState(false);

  const expiring = positions.filter(p => p.dte <= 2);

  if (dismissed || expiring.length === 0) return null;

  return (
    <div className="glass-card border-loss/30 bg-loss/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-loss/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-loss font-bold text-sm">!</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              Expiration Alert — {expiring.length} position{expiring.length > 1 ? 's' : ''} expiring soon
            </h3>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted hover:text-foreground text-sm flex-shrink-0 ml-4"
            >
              &times;
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiring.map(pos => (
              <Link
                key={`${pos.type}-${pos.id}`}
                href={typeToPage[pos.type] || '/log'}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
                  'bg-card-solid/30 border-border/30 hover:bg-card-solid/50 hover:border-border/50'
                )}
              >
                <span className="font-semibold text-sm text-foreground">{pos.ticker}</span>
                <span className="text-xs text-muted">{pos.label}</span>
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  pos.badgeColor
                )}>
                  {pos.badge}
                </span>
                <span className={cn(
                  'text-xs font-bold',
                  pos.dte === 0 ? 'text-loss animate-pulse' : 'text-loss'
                )}>
                  {pos.dte === 0 ? 'TODAY' : `${pos.dte}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
