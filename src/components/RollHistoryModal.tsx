'use client';

import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, SPREAD_TYPE_LABELS } from '@/types';
import { formatDateShort, calculatePL } from '@/lib/utils';
import { calculateCCPL } from '@/hooks/useCoveredCalls';
import { calculateDirectionalPL, calculateSpreadPL } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

type RollableItem = Trade | CoveredCall | DirectionalTrade | SpreadTrade;

interface RollHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: RollableItem[];
  tradeType: 'csp' | 'cc' | 'directional' | 'spread';
}

function getPL(item: RollableItem, type: string): number {
  if (item.status === 'open') return 0;
  switch (type) {
    case 'csp': return calculatePL(item as Trade);
    case 'cc': return calculateCCPL(item as CoveredCall);
    case 'directional': return calculateDirectionalPL(item as DirectionalTrade);
    case 'spread': return calculateSpreadPL(item as SpreadTrade);
    default: return 0;
  }
}

function getLabel(item: RollableItem, type: string): string {
  switch (type) {
    case 'csp': return `$${(item as Trade).strike}P x${item.contracts}`;
    case 'cc': return `$${(item as CoveredCall).strike}C x${item.contracts}`;
    case 'directional': {
      const d = item as DirectionalTrade;
      return `$${d.strike}${d.optionType === 'call' ? 'C' : 'P'} x${d.contracts}`;
    }
    case 'spread': {
      const s = item as SpreadTrade;
      return `${SPREAD_TYPE_LABELS[s.spreadType]} $${s.longStrike}/$${s.shortStrike} x${s.contracts}`;
    }
    default: return '';
  }
}

function getPremium(item: RollableItem, type: string): number {
  switch (type) {
    case 'csp': return (item as Trade).premiumCollected;
    case 'cc': return (item as CoveredCall).premiumCollected;
    case 'directional': return 0;
    case 'spread': {
      const s = item as SpreadTrade;
      return s.netDebit < 0 ? Math.abs(s.netDebit) : 0;
    }
    default: return 0;
  }
}

const typeColors: Record<string, { accent: string; bg: string }> = {
  csp: { accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cc: { accent: 'text-blue-400', bg: 'bg-blue-500/10' },
  directional: { accent: 'text-amber-400', bg: 'bg-amber-500/10' },
  spread: { accent: 'text-purple-400', bg: 'bg-purple-500/10' },
};

export function RollHistoryModal({ isOpen, onClose, chain, tradeType }: RollHistoryModalProps) {
  const { formatCurrency, privacyMode } = useFormatters();
  if (!isOpen || chain.length === 0) return null;

  const color = typeColors[tradeType];
  const ticker = chain[0].ticker;
  const totalPL = chain.reduce((sum, item) => sum + getPL(item, tradeType), 0);
  const totalPremium = chain.reduce((sum, item) => sum + getPremium(item, tradeType), 0);
  const currentPosition = chain.find(item => item.status === 'open');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color.bg)}>
              <span className={cn('font-bold text-sm', color.accent)}>{ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Roll History</h2>
              <p className="text-muted text-sm">{ticker} · {chain.length} position{chain.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            x
          </button>
        </div>

        {/* Summary */}
        <div className="p-5 border-b border-border/50 flex-shrink-0">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="stat-label mb-1">Total P/L</div>
              <div className={cn('text-lg font-bold', totalPL >= 0 ? 'text-profit' : 'text-loss')}>
                {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL)}
              </div>
            </div>
            {totalPremium > 0 && (
              <div>
                <div className="stat-label mb-1">Total Premium</div>
                <div className="text-lg font-bold text-foreground">{privacyMode ? '$***' : formatCurrency(totalPremium)}</div>
              </div>
            )}
            <div>
              <div className="stat-label mb-1">Status</div>
              <div className={cn('text-sm font-semibold', currentPosition ? 'text-accent' : 'text-muted')}>
                {currentPosition ? 'Active' : 'Closed'}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-3 bottom-3 w-px bg-border/30" />

            <div className="space-y-4">
              {chain.map((item, idx) => {
                const pl = getPL(item, tradeType);
                const isActive = item.status === 'open';
                const rollNum = item.rollNumber || (idx + 1);

                return (
                  <div key={item.id} className="relative pl-10">
                    {/* Dot */}
                    <div className={cn(
                      'absolute left-2.5 top-3 w-3 h-3 rounded-full border-2',
                      isActive
                        ? 'bg-accent border-accent shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                        : 'bg-background border-border'
                    )} />

                    <div className={cn(
                      'rounded-xl border p-4',
                      isActive ? 'border-accent/30 bg-accent/5' : 'border-border/20 bg-card-solid/20'
                    )}>
                      {/* Roll label */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                            isActive ? 'bg-accent/10 text-accent' : 'bg-muted/10 text-muted'
                          )}>
                            {rollNum === 1 ? 'Original' : `Roll #${rollNum - 1}`}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              Active
                            </span>
                          )}
                        </div>
                        {!isActive && (
                          <span className={cn('text-sm font-bold', pl >= 0 ? 'text-profit' : 'text-loss')}>
                            {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="text-sm text-foreground font-medium mb-1">
                        {getLabel(item, tradeType)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>Opened {formatDateShort(item.entryDate)}</span>
                        <span>Exp {formatDateShort(item.expiration)}</span>
                        {item.exitDate && <span>Closed {formatDateShort(item.exitDate)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
