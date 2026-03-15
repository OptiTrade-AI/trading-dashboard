'use client';

import { cn } from '@/lib/utils';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import type { CspOpportunity, ScreenerTab } from '@/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface ScreenerOverviewCardsProps {
  topCsp: CspOpportunity | null;
  pipelineHealth: { recent: number; total: number; failed: number; stale: number };
  totalOpportunities: number;
  onTabChange: (tab: ScreenerTab) => void;
}

export function ScreenerOverviewCards({
  topCsp,
  pipelineHealth,
  totalOpportunities,
  onTabChange,
}: ScreenerOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Top CSP Pick */}
      <button
        onClick={() => onTabChange('csp')}
        className="glass-card p-4 text-left hover:border-emerald-500/30 transition-colors"
      >
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Top CSP Pick</p>
        {topCsp ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg font-bold text-foreground">{topCsp.ticker}</span>
              <OpportunityScoreBadge score={topCsp.score} size="sm" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>Strike {formatCurrency(topCsp.strike)}</span>
              <span>{topCsp.dte}d</span>
              <span className="text-profit font-medium">{topCsp.return_on_risk_pct.toFixed(1)}%</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">No data</p>
        )}
      </button>

      {/* Pipeline Health */}
      <div className="glass-card p-4">
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium mb-2">Pipeline Health</p>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className="text-lg font-bold text-foreground">{totalOpportunities}</span>
          <span className="text-xs text-muted">total opportunities</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={cn(
            'font-medium',
            pipelineHealth.recent === pipelineHealth.total ? 'text-emerald-400' : 'text-amber-400',
          )}>
            {pipelineHealth.recent}/{pipelineHealth.total} recent
          </span>
          {pipelineHealth.failed > 0 && (
            <span className="text-red-400 font-medium">{pipelineHealth.failed} failed</span>
          )}
        </div>
      </div>
    </div>
  );
}
