'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { CompactHeat } from './dashboard/CompactHeat';

interface PositionSizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountValue: number;
  maxHeatPercent: number;
  totalCollateral: number;
}

export function PositionSizerModal({
  isOpen, onClose, accountValue, maxHeatPercent, totalCollateral,
}: PositionSizerModalProps) {
  const { formatCurrency, privacyMode } = useFormatters();
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('1');
  const [tradeType, setTradeType] = useState<'csp' | 'spread'>('csp');
  const [maxLossPerSpread, setMaxLossPerSpread] = useState('');

  const sizing = useMemo(() => {
    const strikeNum = parseFloat(strike);
    const contractsNum = parseInt(contracts) || 1;
    if (!strikeNum || strikeNum <= 0) return null;

    let collateralPerContract: number;
    if (tradeType === 'csp') {
      collateralPerContract = strikeNum * 100;
    } else {
      const mlps = parseFloat(maxLossPerSpread);
      if (!mlps || mlps <= 0) return null;
      collateralPerContract = mlps;
    }

    const newCollateral = collateralPerContract * contractsNum;
    const projectedTotal = totalCollateral + newCollateral;
    const projectedHeat = accountValue > 0 ? (projectedTotal / accountValue) * 100 : 0;

    const maxHeatDollars = (maxHeatPercent / 100) * accountValue;
    const availableCollateral = Math.max(0, maxHeatDollars - totalCollateral);
    const maxContracts = collateralPerContract > 0
      ? Math.floor(availableCollateral / collateralPerContract)
      : 0;

    return {
      collateralPerContract,
      newCollateral,
      projectedTotal,
      projectedHeat,
      maxContracts,
      overLimit: projectedHeat > maxHeatPercent,
    };
  }, [strike, contracts, tradeType, maxLossPerSpread, totalCollateral, accountValue, maxHeatPercent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card-solid border border-border rounded-2xl shadow-2xl shadow-black/40 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Position Sizer</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">&times;</button>
        </div>

        {/* Trade type toggle */}
        <div className="flex gap-2 mb-4">
          {(['csp', 'spread'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTradeType(type)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tradeType === type ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
              )}
            >
              {type === 'csp' ? 'CSP' : 'Spread'}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-xs text-muted mb-1 block">Strike Price</label>
            <input
              type="number"
              value={strike}
              onChange={e => setStrike(e.target.value)}
              placeholder="e.g. 150"
              className="input-field"
            />
          </div>
          {tradeType === 'spread' && (
            <div>
              <label className="text-xs text-muted mb-1 block">Max Loss per Spread ($)</label>
              <input
                type="number"
                value={maxLossPerSpread}
                onChange={e => setMaxLossPerSpread(e.target.value)}
                placeholder="e.g. 500"
                className="input-field"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-muted mb-1 block">Contracts</label>
            <input
              type="number"
              value={contracts}
              onChange={e => setContracts(e.target.value)}
              placeholder="1"
              className="input-field"
              min="1"
            />
          </div>
        </div>

        {/* Results */}
        {sizing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/30 rounded-xl p-3">
                <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Collateral Needed</div>
                <div className="text-lg font-bold text-foreground">
                  {privacyMode ? '$***' : formatCurrency(sizing.newCollateral)}
                </div>
              </div>
              <div className="bg-background/30 rounded-xl p-3">
                <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Max Contracts</div>
                <div className={cn('text-lg font-bold', sizing.maxContracts > 0 ? 'text-profit' : 'text-loss')}>
                  {sizing.maxContracts}
                </div>
              </div>
            </div>

            {/* Projected heat */}
            <div className="bg-background/30 rounded-xl p-3">
              <div className="text-[11px] text-muted uppercase tracking-wider mb-2">Projected Portfolio Heat</div>
              <CompactHeat heat={sizing.projectedHeat} maxHeatPercent={maxHeatPercent} privacyMode={privacyMode} />
              {sizing.overLimit && (
                <div className="text-xs text-loss mt-2 font-medium">
                  Warning: This trade would exceed your {maxHeatPercent}% heat limit
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
