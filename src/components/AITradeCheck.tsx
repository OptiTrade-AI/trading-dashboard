'use client';

import { useTradeCheck } from '@/hooks/useTradeCheck';
import { cn } from '@/lib/utils';
import { DiscussChatLink } from './DiscussChatLink';

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
  };
  disabled?: boolean;
}

const recColors = {
  proceed: { bg: 'bg-profit/10', border: 'border-profit/30', text: 'text-profit', label: 'Proceed' },
  caution: { bg: 'bg-caution/10', border: 'border-caution/30', text: 'text-caution', label: 'Caution' },
  reconsider: { bg: 'bg-loss/10', border: 'border-loss/30', text: 'text-loss', label: 'Reconsider' },
};

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
          'rounded-xl border p-3 space-y-2',
          recColors[result.recommendation].bg,
          recColors[result.recommendation].border,
        )}>
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-bold uppercase', recColors[result.recommendation].text)}>
              {recColors[result.recommendation].label}
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-[10px] text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-1.5 text-xs text-foreground/80">
            <p>{result.sizingNote}</p>
            <p>{result.historyNote}</p>
            <p>{result.portfolioNote}</p>
          </div>
          <DiscussChatLink
            context={`I'm considering a ${trade.strategy} trade on ${trade.ticker} (strike $${trade.strike}, ${trade.contracts} contracts, exp ${trade.expiration}). The AI trade check said: ${result.recommendation.toUpperCase()}. Sizing: ${result.sizingNote}. History: ${result.historyNote}. Portfolio: ${result.portfolioNote}`}
            sourceFeature="Trade Check"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
