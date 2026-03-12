'use client';

import { useTradeCheck } from '@/hooks/useTradeCheck';
import { cn } from '@/lib/utils';
import { DiscussChatLink } from './DiscussChatLink';
import type { TradeCheckMetrics } from '@/types';

interface AITradeCheckProps {
  trade: {
    ticker: string;
    strategy: string;
    strike?: number;
    contracts: number;
    expiration: string;
    premium?: number;
    collateral?: number;
    costAtOpen?: number;
    entryPrice?: number;
    spreadType?: string;
    longStrike?: number;
    shortStrike?: number;
    netDebit?: number;
    maxLoss?: number;
    costBasisPerShare?: number;
  };
  disabled?: boolean;
}

const recColors = {
  proceed: { bg: 'bg-profit/10', border: 'border-profit/30', text: 'text-profit', label: 'Proceed' },
  caution: { bg: 'bg-caution/10', border: 'border-caution/30', text: 'text-caution', label: 'Caution' },
  reconsider: { bg: 'bg-loss/10', border: 'border-loss/30', text: 'text-loss', label: 'Reconsider' },
};

function MetricItem({ label, value, color }: { label: string; value: string; color?: 'green' | 'amber' | 'red' }) {
  const colorClass = color === 'green' ? 'text-profit' : color === 'red' ? 'text-loss' : color === 'amber' ? 'text-caution' : 'text-foreground';
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={cn('text-xs font-semibold', colorClass)}>{value}</div>
    </div>
  );
}

function MetricsBar({ metrics, strategy }: { metrics: TradeCheckMetrics; strategy: string }) {
  const items: { label: string; value: string; color?: 'green' | 'amber' | 'red' }[] = [];
  const s = strategy.toUpperCase();

  if (metrics.stockPrice != null) {
    items.push({ label: 'Stock', value: `$${metrics.stockPrice.toFixed(2)}` });
  }

  if (metrics.distanceToStrike != null) {
    const dist = metrics.distanceToStrike;
    const color = dist > 10 ? 'green' : dist > 5 ? 'amber' : 'red';
    items.push({ label: 'Dist to Strike', value: `${dist.toFixed(1)}%`, color });
  }

  if (s === 'CSP') {
    if (metrics.roc != null) {
      const color = metrics.roc >= 1.5 ? 'green' : metrics.roc >= 0.75 ? 'amber' : 'red';
      items.push({ label: 'ROC', value: `${metrics.roc.toFixed(2)}%`, color });
    }
    if (metrics.annualizedROC != null) {
      const color = metrics.annualizedROC >= 15 ? 'green' : metrics.annualizedROC >= 8 ? 'amber' : 'red';
      items.push({ label: 'Ann. ROC', value: `${metrics.annualizedROC.toFixed(1)}%`, color });
    }
  }

  if (s === 'CC') {
    if (metrics.strikeVsCostBasis != null) {
      const color = metrics.strikeVsCostBasis > 0 ? 'green' : metrics.strikeVsCostBasis === 0 ? 'amber' : 'red';
      items.push({ label: 'Strike vs Basis', value: `${metrics.strikeVsCostBasis >= 0 ? '+' : ''}$${metrics.strikeVsCostBasis.toFixed(2)}`, color });
    }
    if (metrics.ros != null) {
      const color = metrics.ros >= 1 ? 'green' : metrics.ros >= 0.5 ? 'amber' : 'red';
      items.push({ label: 'ROS', value: `${metrics.ros.toFixed(2)}%`, color });
    }
    if (metrics.annualizedROS != null) {
      const color = metrics.annualizedROS >= 12 ? 'green' : metrics.annualizedROS >= 6 ? 'amber' : 'red';
      items.push({ label: 'Ann. ROS', value: `${metrics.annualizedROS.toFixed(1)}%`, color });
    }
    if (metrics.calledAwayPL != null) {
      const color = metrics.calledAwayPL >= 0 ? 'green' : 'red';
      items.push({ label: 'Called P/L', value: `${metrics.calledAwayPL >= 0 ? '+' : ''}$${metrics.calledAwayPL.toFixed(0)}`, color });
    }
  }

  if (metrics.delta != null) {
    const absDelta = Math.abs(metrics.delta);
    const color = absDelta <= 0.30 ? 'green' : absDelta <= 0.40 ? 'amber' : 'red';
    items.push({ label: 'Delta', value: metrics.delta.toFixed(3), color });
  }

  if (metrics.iv != null) {
    items.push({ label: 'IV', value: `${(metrics.iv * 100).toFixed(1)}%` });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 bg-background/30 rounded-lg p-2">
      {items.map((item) => (
        <MetricItem key={item.label} {...item} />
      ))}
    </div>
  );
}

export function AITradeCheck({ trade, disabled }: AITradeCheckProps) {
  const { result, isLoading, error, checkTrade, reset } = useTradeCheck();

  const canCheck = trade.ticker && trade.contracts && trade.expiration;

  if (!canCheck && !result) return null;

  return (
    <div className="space-y-2">
      {!result && !isLoading && (
        <button
          type="button"
          onClick={() => checkTrade(trade)}
          disabled={disabled || !canCheck || isLoading}
          className={cn(
            'w-full py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2',
            'border border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          AI Check
        </button>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-xs text-muted">Checking trade...</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-loss text-center py-1">{error}</div>
      )}

      {result && (
        <div className={cn(
          'rounded-xl border p-3 space-y-2.5',
          recColors[result.recommendation].bg,
          recColors[result.recommendation].border,
        )}>
          {/* Recommendation badge + headline */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className={cn(
                'shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                recColors[result.recommendation].text,
                result.recommendation === 'proceed' ? 'bg-profit/20' :
                result.recommendation === 'caution' ? 'bg-caution/20' : 'bg-loss/20'
              )}>
                {recColors[result.recommendation].label}
              </span>
              <p className="text-xs text-foreground/90 leading-snug">{result.headline}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-[10px] text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </div>

          {/* Metrics bar */}
          {result.metrics && (
            <MetricsBar metrics={result.metrics} strategy={trade.strategy} />
          )}

          {/* Insights list */}
          {result.insights && result.insights.length > 0 && (
            <div className="space-y-1.5">
              {result.insights.map((insight, i) => (
                <div key={i} className="text-xs text-foreground/80">
                  <span className="font-semibold text-foreground/90">{insight.label}: </span>
                  {insight.text}
                </div>
              ))}
            </div>
          )}

          <DiscussChatLink
            context={`I'm considering a ${trade.strategy} trade on ${trade.ticker} (strike $${trade.strike}, ${trade.contracts} contracts, exp ${trade.expiration}). AI trade check: ${result.recommendation.toUpperCase()} — ${result.headline}${result.insights?.length ? '. ' + result.insights.map(i => `${i.label}: ${i.text}`).join('. ') : ''}`}
            sourceFeature="Trade Check"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
