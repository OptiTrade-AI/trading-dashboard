'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { OpenPosition } from './PositionsTimeline';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useStockAggregates } from '@/hooks/useStockAggregates';
import { useOptionAggregates } from '@/hooks/useOptionAggregates';
import { useFormatters } from '@/hooks/useFormatters';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, AggBar } from '@/types';
import {
  formatCurrency as rawFormatCurrency,
  formatDateShort,
  calculateReturnOnCollateral,
  calculateDTE,
  buildOptionSymbol,
  cn,
} from '@/lib/utils';

const COLORS = {
  profit: '#10b981',
  loss: '#ef4444',
  grid: 'rgba(63, 63, 70, 0.3)',
  tooltipBg: 'rgba(24, 24, 27, 0.95)',
  tooltipBorder: 'rgba(63, 63, 70, 0.5)',
  tooltipText: '#fafafa',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: COLORS.tooltipBg,
    border: `1px solid ${COLORS.tooltipBorder}`,
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: COLORS.tooltipText, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: COLORS.tooltipText },
};

const strategyColors: Record<string, string> = {
  csp: '#10b981',
  cc: '#3b82f6',
  directional: '#f59e0b',
  spread: '#a855f7',
};

interface PositionDetailModalProps {
  position: OpenPosition | null;
  isOpen: boolean;
  onClose: () => void;
}

function MetricCell({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted mb-0.5">{label}</div>
      <div className={cn('text-sm font-bold', colorClass || 'text-foreground')}>{value}</div>
    </div>
  );
}

function YearlyChart({ ticker, strike }: { ticker: string; strike?: number }) {
  const { allBars, isLoading } = useStockAggregates([ticker]);
  const bars = allBars.get(ticker) ?? [];

  if (isLoading) {
    return <div className="h-[200px] w-full bg-foreground/5 rounded-lg animate-pulse" />;
  }

  if (bars.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted text-sm">
        No yearly data available
      </div>
    );
  }

  const data = bars.map((b) => ({
    date: new Date(b.t).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    price: b.c,
  }));

  const firstPrice = bars[0].c;
  const lastPrice = bars[bars.length - 1].c;
  const isUp = lastPrice >= firstPrice;
  const color = isUp ? COLORS.profit : COLORS.loss;

  const prices = bars.map((b) => b.c);
  const allPrices = strike ? [...prices, strike] : prices;
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1 || 1;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id={`yearlyGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#71717a' }}
          interval="preserveStartEnd"
          tickLine={false}
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tick={{ fontSize: 10, fill: '#71717a' }}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          width={50}
          tickLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']}
        />
        {strike && (
          <ReferenceLine
            y={strike}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: `Strike $${strike}`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          fill={`url(#yearlyGrad-${ticker})`}
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function OptionChart({
  bars,
  entryPrice,
  timespan,
  privacyMode,
}: {
  bars: AggBar[];
  entryPrice: number | null;
  timespan: 'minute' | 'day';
  privacyMode: boolean;
}) {
  if (bars.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted text-sm">
        No data available
      </div>
    );
  }

  const data = bars.map((b) => ({
    label:
      timespan === 'minute'
        ? new Date(b.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : new Date(b.t).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    price: b.c,
  }));

  const firstPrice = bars[0].c;
  const lastPrice = bars[bars.length - 1].c;
  const isUp = lastPrice >= firstPrice;
  const color = isUp ? COLORS.profit : COLORS.loss;

  const prices = bars.map((b) => b.c);
  const allPrices = entryPrice ? [...prices, entryPrice] : prices;
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1 || 0.05;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="optionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#71717a' }}
          interval="preserveStartEnd"
          tickLine={false}
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tick={{ fontSize: 10, fill: '#71717a' }}
          tickFormatter={(v: number) => privacyMode ? '$*' : `$${v.toFixed(2)}`}
          width={55}
          tickLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: any) => [privacyMode ? '$***' : `$${Number(v).toFixed(2)}`, 'Price']}
        />
        {entryPrice !== null && !privacyMode && (
          <ReferenceLine
            y={entryPrice}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: `Entry $${entryPrice.toFixed(2)}`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          fill="url(#optionGrad)"
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type ChartTab = 'today' | 'sinceEntry' | 'stock1y';

export function PositionDetailModal({ position, isOpen, onClose }: PositionDetailModalProps) {
  const [chartTab, setChartTab] = useState<ChartTab>('today');
  const { formatCurrency, privacyMode } = useFormatters();

  const tickers = useMemo(
    () => (position ? [position.ticker] : []),
    [position]
  );
  const { prices } = useStockPrices(isOpen ? tickers : []);

  // Build option symbol(s) from raw trade
  const { optionSymbol, secondSymbol, entryPricePerContract } = useMemo(() => {
    if (!position?.rawTrade) return { optionSymbol: null, secondSymbol: null, entryPricePerContract: null };
    const raw = position.rawTrade;

    if (position.type === 'csp') {
      const t = raw as Trade;
      return {
        optionSymbol: buildOptionSymbol(t.ticker, t.expiration, 'P', t.strike),
        secondSymbol: null,
        entryPricePerContract: t.premiumCollected / (t.contracts * 100),
      };
    }
    if (position.type === 'cc') {
      const c = raw as CoveredCall;
      return {
        optionSymbol: buildOptionSymbol(c.ticker, c.expiration, 'C', c.strike),
        secondSymbol: null,
        entryPricePerContract: c.premiumCollected / (c.contracts * 100),
      };
    }
    if (position.type === 'directional') {
      const t = raw as DirectionalTrade;
      const type = t.optionType === 'call' ? 'C' : 'P';
      return {
        optionSymbol: buildOptionSymbol(t.ticker, t.expiration, type, t.strike),
        secondSymbol: null,
        entryPricePerContract: t.entryPrice,
      };
    }
    if (position.type === 'spread') {
      const s = raw as SpreadTrade;
      const isCall = s.spreadType === 'call_debit' || s.spreadType === 'call_credit';
      const optType: 'C' | 'P' = isCall ? 'C' : 'P';
      return {
        optionSymbol: buildOptionSymbol(s.ticker, s.expiration, optType, s.longStrike),
        secondSymbol: buildOptionSymbol(s.ticker, s.expiration, optType, s.shortStrike),
        entryPricePerContract: s.netDebit / (s.contracts * 100),
      };
    }
    return { optionSymbol: null, secondSymbol: null, entryPricePerContract: null };
  }, [position]);

  const today = new Date().toISOString().slice(0, 10);
  const entryDate = position?.rawTrade?.entryDate?.slice(0, 10) ?? today;

  const isSpread = position?.type === 'spread';

  // Only fetch when modal open + relevant tab active
  const intradayResult = useOptionAggregates(
    isOpen && chartTab === 'today' ? optionSymbol : null,
    isOpen && chartTab === 'today' && isSpread ? secondSymbol : null,
    today, today, 'minute', 5
  );

  const historyResult = useOptionAggregates(
    isOpen && chartTab === 'sinceEntry' ? optionSymbol : null,
    isOpen && chartTab === 'sinceEntry' && isSpread ? secondSymbol : null,
    entryDate, today, 'day', 1
  );

  if (!isOpen || !position) return null;

  const color = strategyColors[position.type] || '#10b981';
  const stockPrice = prices.get(position.ticker);
  const raw = position.rawTrade;

  // Determine strike for chart reference line
  const strike = raw
    ? 'strike' in raw
      ? (raw as any).strike as number
      : 'longStrike' in raw
        ? (raw as any).shortStrike as number
        : undefined
    : undefined;

  // Breakeven calculation
  const effectiveBreakeven = (() => {
    if (!raw) return null;
    if (position.type === 'csp') {
      const t = raw as Trade;
      return t.strike - t.premiumCollected / (t.contracts * 100);
    }
    if (position.type === 'cc') {
      const c = raw as CoveredCall;
      // Strike + premium per share = price where short call loses more than premium collected
      return c.strike + c.premiumCollected / (c.contracts * 100);
    }
    if (position.type === 'directional') {
      const t = raw as DirectionalTrade;
      if (t.optionType === 'call') return t.strike + t.entryPrice;
      return t.strike - t.entryPrice;
    }
    if (position.type === 'spread') {
      const s = raw as SpreadTrade;
      if (s.netDebit < 0) {
        // Credit spread
        if (s.spreadType.startsWith('put')) return s.shortStrike - Math.abs(s.netDebit) / (s.contracts * 100);
        return s.shortStrike + Math.abs(s.netDebit) / (s.contracts * 100);
      }
      // Debit spread
      if (s.spreadType.startsWith('call')) return s.longStrike + s.netDebit / (s.contracts * 100);
      return s.longStrike - s.netDebit / (s.contracts * 100);
    }
    return null;
  })();

  // Max loss
  const maxLoss = (() => {
    if (!raw) return null;
    if (position.type === 'csp') {
      const t = raw as Trade;
      return t.collateral - t.premiumCollected;
    }
    if (position.type === 'cc') return 'Shares drop to $0';
    if (position.type === 'directional') {
      const t = raw as DirectionalTrade;
      return t.costAtOpen;
    }
    if (position.type === 'spread') {
      return (raw as SpreadTrade).maxLoss;
    }
    return null;
  })();

  // Probability of profit (delta proxy)
  const probProfit = (() => {
    if (position.delta === null) return null;
    const isSoldPosition = position.type === 'csp' || position.type === 'cc'
      || (position.type === 'spread' && raw && (raw as SpreadTrade).netDebit < 0);
    if (isSoldPosition) return (1 - Math.abs(position.delta)) * 100;
    return Math.abs(position.delta) * 100;
  })();

  // Profit capture (sold positions)
  const isSold = position.type === 'csp' || position.type === 'cc' || (position.type === 'spread' && raw && (raw as SpreadTrade).netDebit < 0);
  const profitCapture = (position.unrealizedPL !== null && isSold && position.maxPremium > 0)
    ? Math.min(Math.max((position.unrealizedPL / position.maxPremium) * 100, -100), 100)
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-bold px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {position.ticker}
            </span>
            {position.companyName && (
              <span className="text-sm text-muted">{position.companyName}</span>
            )}
            <span className="text-sm text-foreground font-medium">{position.label} {position.detail}</span>
          </div>
          <div className="flex items-center gap-3">
            {stockPrice && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {privacyMode ? '$***' : `$${stockPrice.price.toFixed(2)}`}
                </span>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  stockPrice.changePercent >= 0
                    ? 'bg-profit/10 text-profit'
                    : 'bg-loss/10 text-loss'
                )}>
                  {privacyMode ? '**%' : `${stockPrice.changePercent >= 0 ? '+' : ''}${stockPrice.changePercent.toFixed(2)}%`}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground transition-colors text-lg leading-none px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="p-5 border-b border-border/30">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {position.unrealizedPL !== null && (
              <MetricCell
                label="Unrealized P/L"
                value={privacyMode ? '$***' : `${position.unrealizedPL >= 0 ? '+' : ''}${rawFormatCurrency(position.unrealizedPL)}`}
                colorClass={position.unrealizedPL >= 0 ? 'text-profit' : 'text-loss'}
              />
            )}
            <MetricCell
              label="DTE"
              value={`${position.dte}d`}
              colorClass={position.dte <= 7 ? 'text-loss' : position.dte <= 21 ? 'text-caution' : undefined}
            />
            {position.delta !== null && (
              <MetricCell label="Delta" value={privacyMode ? '***' : position.delta.toFixed(3)} />
            )}
            {position.theta !== null && (
              <MetricCell
                label="Theta ($/day)"
                value={privacyMode ? '$***' : rawFormatCurrency(Math.abs(position.theta * 100))}
                colorClass="text-profit"
              />
            )}
            {position.iv !== null && (
              <MetricCell label="IV" value={privacyMode ? '**%' : `${(position.iv * 100).toFixed(1)}%`} />
            )}

            {/* Strategy-specific metrics */}
            {profitCapture !== null && (
              <MetricCell
                label="Profit Capture"
                value={privacyMode ? '**%' : `${profitCapture.toFixed(1)}%`}
                colorClass={profitCapture >= 50 ? 'text-profit' : profitCapture >= 0 ? 'text-caution' : 'text-loss'}
              />
            )}
            {position.type === 'csp' && raw && (
              <>
                <MetricCell
                  label="Collateral"
                  value={formatCurrency((raw as Trade).collateral)}
                />
                <MetricCell
                  label="ROC"
                  value={privacyMode ? '**%' : `${calculateReturnOnCollateral(raw as Trade).toFixed(1)}%`}
                />
              </>
            )}
            {position.type === 'cc' && raw && (() => {
              const cc = raw as CoveredCall;
              const entryPerShare = cc.premiumCollected / (cc.contracts * 100);
              const currentPrice = position.unrealizedPL !== null
                ? entryPerShare - position.unrealizedPL / (cc.contracts * 100)
                : null;
              const plPerContract = position.unrealizedPL !== null
                ? position.unrealizedPL / cc.contracts
                : null;
              return (
                <>
                  <MetricCell
                    label="Cost Basis"
                    value={formatCurrency(cc.costBasis)}
                  />
                  <MetricCell
                    label="Shares"
                    value={privacyMode ? '***' : `${cc.sharesHeld}`}
                  />
                  {currentPrice !== null && (
                    <MetricCell
                      label="Current Price"
                      value={privacyMode ? '$***' : `$${currentPrice.toFixed(2)}/sh`}
                    />
                  )}
                  {plPerContract !== null && (
                    <MetricCell
                      label="P/L per Contract"
                      value={privacyMode ? '$***' : `${plPerContract >= 0 ? '+' : ''}${rawFormatCurrency(plPerContract)}`}
                      colorClass={plPerContract >= 0 ? 'text-profit' : 'text-loss'}
                    />
                  )}
                </>
              );
            })()}
            {position.type === 'directional' && raw && (
              <>
                <MetricCell
                  label="Cost at Open"
                  value={formatCurrency((raw as DirectionalTrade).costAtOpen)}
                />
                {position.unrealizedPL !== null && (
                  <MetricCell
                    label="P/L %"
                    value={privacyMode ? '**%' : `${((position.unrealizedPL / (raw as DirectionalTrade).costAtOpen) * 100).toFixed(1)}%`}
                    colorClass={position.unrealizedPL >= 0 ? 'text-profit' : 'text-loss'}
                  />
                )}
              </>
            )}
            {position.type === 'spread' && raw && (
              <>
                <MetricCell
                  label="Max Profit"
                  value={formatCurrency((raw as SpreadTrade).maxProfit)}
                />
                <MetricCell
                  label="Max Loss"
                  value={formatCurrency((raw as SpreadTrade).maxLoss)}
                  colorClass="text-loss"
                />
              </>
            )}
          </div>
        </div>

        {/* Price Chart */}
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-2 mb-3">
            {(['today', 'sinceEntry', 'stock1y'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setChartTab(tab)}
                className={cn(
                  'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                  chartTab === tab ? 'bg-accent/15 text-accent' : 'text-muted hover:text-foreground'
                )}
              >
                {tab === 'today' ? 'Today' : tab === 'sinceEntry' ? 'Since Entry' : 'Stock 1Y'}
              </button>
            ))}
          </div>
          {chartTab === 'today' ? (
            intradayResult.isLoading ? (
              <div className="h-[200px] w-full bg-foreground/5 rounded-lg animate-pulse" />
            ) : (
              <OptionChart
                bars={isSpread && intradayResult.netBars ? intradayResult.netBars : intradayResult.bars}
                entryPrice={entryPricePerContract}
                timespan="minute"
                privacyMode={privacyMode}
              />
            )
          ) : chartTab === 'sinceEntry' ? (
            historyResult.isLoading ? (
              <div className="h-[200px] w-full bg-foreground/5 rounded-lg animate-pulse" />
            ) : (
              <OptionChart
                bars={isSpread && historyResult.netBars ? historyResult.netBars : historyResult.bars}
                entryPrice={entryPricePerContract}
                timespan="day"
                privacyMode={privacyMode}
              />
            )
          ) : (
            <YearlyChart ticker={position.ticker} strike={strike} />
          )}
        </div>

        {/* Position Details */}
        {raw && (
          <div className="p-5 border-b border-border/30">
            <h4 className="text-sm font-semibold text-foreground mb-3">Position Details</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Entry Date</span>
                <span className="text-foreground">{formatDateShort(raw.entryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Expiration</span>
                <span className="text-foreground">{formatDateShort(raw.expiration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">DTE at Entry</span>
                <span className="text-foreground">{raw.dteAtEntry}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Current DTE</span>
                <span className="text-foreground">{calculateDTE(raw.expiration)}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  {position.type === 'directional' ? 'Cost' : 'Premium'}
                </span>
                <span className="text-foreground">
                  {position.type === 'directional'
                    ? formatCurrency((raw as DirectionalTrade).costAtOpen)
                    : position.type === 'spread'
                      ? formatCurrency(Math.abs((raw as SpreadTrade).netDebit))
                      : position.type === 'cc'
                        ? `$${((raw as CoveredCall).premiumCollected / ((raw as CoveredCall).contracts * 100)).toFixed(2)}/sh (${formatCurrency((raw as CoveredCall).premiumCollected)} total)`
                        : formatCurrency((raw as Trade).premiumCollected)
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Contracts</span>
                <span className="text-foreground">{raw.contracts}</span>
              </div>
              {raw.rollChainId && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted">Roll Chain</span>
                  <span className="text-accent">Roll #{raw.rollNumber ?? 1}</span>
                </div>
              )}
              {raw.notes && (
                <div className="col-span-2 mt-1">
                  <span className="text-muted">Notes: </span>
                  <span className="text-foreground">{raw.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Metrics */}
        <div className="p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Risk Metrics</h4>
          <div className="border border-border/30 rounded-xl p-4 space-y-2.5">
            {effectiveBreakeven !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Breakeven</span>
                <span className="text-foreground font-semibold">
                  {privacyMode ? '$***' : `$${effectiveBreakeven.toFixed(2)}`}
                </span>
              </div>
            )}
            {maxLoss !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Max Loss</span>
                <span className="text-loss font-semibold">
                  {typeof maxLoss === 'string'
                    ? maxLoss
                    : privacyMode ? '$***' : rawFormatCurrency(maxLoss)
                  }
                </span>
              </div>
            )}
            {probProfit !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Est. Prob. of Profit</span>
                <span className={cn(
                  'font-semibold',
                  probProfit >= 60 ? 'text-profit' : probProfit >= 40 ? 'text-caution' : 'text-loss'
                )}>
                  {privacyMode ? '**%' : `${probProfit.toFixed(0)}%`}
                </span>
              </div>
            )}
            {probProfit !== null && (
              <div className="text-[10px] text-muted italic">Based on delta as proxy</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
