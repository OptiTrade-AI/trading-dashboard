'use client';

import { cn } from '@/lib/utils';
import type { OptimizerResult } from '@/types';

interface OptimizerHoldingSummaryProps {
  data: OptimizerResult;
  privacyMode: boolean;
  onRunAI: () => void;
  aiLoading: boolean;
}

export function OptimizerHoldingSummary({ data, privacyMode, onRunAI, aiLoading }: OptimizerHoldingSummaryProps) {
  const mask = (val: string) => privacyMode ? '***' : val;
  const pctUnderwater = ((data.stockPrice - data.costBasisPerShare) / data.costBasisPerShare) * 100;
  const gap = data.costBasisPerShare - data.stockPrice;
  const totalGap = gap * data.totalShares;
  const premiumProgress = data.historicalCCPremium > 0
    ? Math.min(100, (data.historicalCCPremium / totalGap) * 100)
    : 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">{data.ticker}</h3>
          <p className="text-sm text-muted mt-0.5">
            {data.totalShares} shares | {data.availableContracts} contracts available
            {data.coveredContracts > 0 && ` | ${data.coveredContracts} covered`}
          </p>
        </div>
        <button
          onClick={onRunAI}
          disabled={aiLoading}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
            'bg-purple-500/15 text-purple-400 border border-purple-500/30',
            'hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {aiLoading ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          )}
          AI Analysis
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div>
          <p className="text-xs text-muted">Current Price</p>
          <p className="text-lg font-bold text-foreground">{mask('$' + data.stockPrice.toFixed(2))}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Cost Basis</p>
          <p className="text-lg font-bold text-foreground">{mask('$' + data.costBasisPerShare.toFixed(2))}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Gap to Breakeven</p>
          <p className={cn('text-lg font-bold', pctUnderwater < 0 ? 'text-red-400' : 'text-emerald-400')}>
            {mask('$' + gap.toFixed(2))} <span className="text-sm">({pctUnderwater.toFixed(1)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">CC Premium Earned</p>
          <p className={cn('text-lg font-bold', data.historicalCCPremium >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {mask('$' + data.historicalCCPremium.toFixed(0))}
          </p>
        </div>
      </div>

      {/* Recovery progress bar */}
      {totalGap > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Premium recovery progress</span>
            <span>{mask('$' + data.historicalCCPremium.toFixed(0))} / {mask('$' + totalGap.toFixed(0))} needed</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${premiumProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
