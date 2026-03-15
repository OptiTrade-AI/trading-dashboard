'use client';

import { useState, useEffect } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useCoveredCalls } from '@/hooks/useCoveredCalls';
import { useDirectionalTrades } from '@/hooks/useDirectionalTrades';
import { useSpreads } from '@/hooks/useSpreads';
import { useStockEvents } from '@/hooks/useStockEvents';
import {
  PLByTickerChart,
  TradeFrequencyChart,
  CumulativePLWithDrawdownChart,
  StrategyDonutChart,
  PLHeatmapCalendar,
  WinRateRow,
  MonthlyStackedChart,
  PLDistributionChart,
  DaysHeldScatterChart,
  WinLossStreakBar,
  RollingPLSparkline,
  HoldTimeAnalyzer,
  BenchmarkComparisonChart,
} from '@/components/Charts';
import { useStockAggregates } from '@/hooks/useStockAggregates';
import { useAnnotations } from '@/hooks/useAnnotations';
import { cn } from '@/lib/utils';
import { BehavioralPatterns } from '@/components/BehavioralPatterns';
import { SkeletonStatCards, ErrorState } from '@/components/SkeletonLoader';
import { useFormatters } from '@/hooks/useFormatters';
import { useAnalyticsData, type TimeRange, type AnalyticsData, type TradeWithPL } from '@/hooks/useAnalyticsData';
import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
type StrategyTab = 'all' | 'csp' | 'cc' | 'directional' | 'spreads';

export default function Analytics() {
  const { closedTrades, accountSettings, isLoading: tradesLoading, error: tradesError, retry: tradesRetry } = useTrades();
  const { closedCalls, isLoading: ccLoading, error: ccError, retry: ccRetry } = useCoveredCalls();
  const { closedTrades: closedDirectional, isLoading: dirLoading, error: dirError, retry: dirRetry } = useDirectionalTrades();
  const { closedSpreads, isLoading: spreadsLoading, error: spreadsError, retry: spreadsRetry } = useSpreads();
  const { stockEvents, isLoading: stockLoading, error: stockError, retry: stockRetry } = useStockEvents();
  const [includeStockPL, setIncludeStockPL] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [strategyTab, setStrategyTab] = useState<StrategyTab>('all');
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [strategyTradesModal, setStrategyTradesModal] = useState<string | null>(null);
  const [annotationInput, setAnnotationInput] = useState<{ date: string; label: string } | null>(null);
  const { formatCurrency, privacyMode } = useFormatters();
  const { allBars: spyBars } = useStockAggregates(showBenchmark ? ['SPY'] : []);
  const { annotations, addAnnotation, deleteAnnotation } = useAnnotations();

  const isLoading = tradesLoading || ccLoading || dirLoading || spreadsLoading || stockLoading;
  const firstError = tradesError || ccError || dirError || spreadsError || stockError;
  const retryAll = () => { tradesRetry(); ccRetry(); dirRetry(); spreadsRetry(); stockRetry(); };

  const analytics = useAnalyticsData(
    closedTrades, closedCalls, closedDirectional, closedSpreads,
    stockEvents, includeStockPL, timeRange, accountSettings.accountValue,
  );

  // Analytics computation extracted to useAnalyticsData hook

  if (firstError) {
    return <ErrorState message={firstError} onRetry={retryAll} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
          <p className="text-muted mt-1">Loading your trading data...</p>
        </div>
        <SkeletonStatCards count={4} />
        <SkeletonStatCards count={4} />
      </div>
    );
  }

  if (closedTrades.length === 0 && closedCalls.length === 0 && closedDirectional.length === 0 && closedSpreads.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
          <p className="text-muted mt-1">Performance insights and trends</p>
        </div>
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📈</span>
          </div>
          <h3 className="text-foreground font-medium mb-2">No data yet</h3>
          <p className="text-muted text-sm">Close some trades to see analytics</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
            <p className="text-muted mt-1">Performance insights and trends</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="glass-card p-12 text-center">
          <h3 className="text-foreground font-medium mb-2">No trades in this period</h3>
          <p className="text-muted text-sm">Try a different time range</p>
        </div>
      </div>
    );
  }

  // Build strategy tabs
  const strategyTabs: { key: StrategyTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: analytics.totalTrades },
    ...(analytics.cspCount > 0 ? [{ key: 'csp' as const, label: 'CSP', count: analytics.cspCount }] : []),
    ...(analytics.ccCount > 0 ? [{ key: 'cc' as const, label: 'CC', count: analytics.ccCount }] : []),
    ...(analytics.dirCount > 0 ? [{ key: 'directional' as const, label: 'Directional', count: analytics.dirCount }] : []),
    ...(analytics.spreadCount > 0 ? [{ key: 'spreads' as const, label: 'Spreads', count: analytics.spreadCount }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
          <p className="text-muted mt-1">
            {analytics.totalTrades} closed trades across {strategyTabs.length - 1} strategies
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stockEvents.length > 0 && (
            <button
              onClick={() => setIncludeStockPL(!includeStockPL)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                includeStockPL
                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                  : 'bg-background/30 text-muted border-border/30 hover:text-foreground'
              )}
            >
              {includeStockPL ? 'Stock P/L On' : 'Stock P/L Off'}
            </button>
          )}
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* ── Hero Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HeroStat
          label={timeRange === 'ALL' ? 'Total P/L' : `P/L (${timeRange})`}
          value={privacyMode ? '$***' : `${analytics.totalPL >= 0 ? '+' : ''}${formatCurrency(analytics.totalPL)}`}
          variant={analytics.totalPL >= 0 ? 'profit' : 'loss'}
          sub={privacyMode ? '**% return' : `${analytics.returnOnAccount >= 0 ? '+' : ''}${analytics.returnOnAccount.toFixed(1)}% return`}
        />
        <HeroStat
          label="This Month"
          value={privacyMode ? '$***' : `${analytics.thisMonthPL >= 0 ? '+' : ''}${formatCurrency(analytics.thisMonthPL)}`}
          variant={analytics.thisMonthPL >= 0 ? 'profit' : 'loss'}
          sub={privacyMode ? '$***/trade' : `Avg ${formatCurrency(analytics.avgPLPerTrade)}/trade`}
        />
        <HeroStat
          label="This Year"
          value={privacyMode ? '$***' : `${analytics.thisYearPL >= 0 ? '+' : ''}${formatCurrency(analytics.thisYearPL)}`}
          variant={analytics.thisYearPL >= 0 ? 'profit' : 'loss'}
          sub={privacyMode ? '$*** premium' : `${formatCurrency(analytics.totalPremiumCollected)} premium`}
        />
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(63,63,70,0.25)" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke={COLORS.accent}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(analytics.overallWinRate / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                style={{ filter: `drop-shadow(0 0 6px ${COLORS.accent}40)` }}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">{privacyMode ? '**%' : `${analytics.overallWinRate.toFixed(0)}%`}</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="stat-label mb-1">Win Rate</div>
            <div className="text-sm text-muted">{analytics.totalTrades} trades</div>
            {analytics.rollingPLData.length > 0 && (
              <div className="mt-1">
                <RollingPLSparkline data={analytics.rollingPLData} value={analytics.rolling30DayPL} />
              </div>
            )}
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(63,63,70,0.25)" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={analytics.avgPremiumCaptured >= 50 ? COLORS.profit : COLORS.loss}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(Math.min(Math.max(analytics.avgPremiumCaptured, 0), 100) / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                style={{ filter: `drop-shadow(0 0 6px ${analytics.avgPremiumCaptured >= 50 ? COLORS.profit : COLORS.loss}40)` }}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">{privacyMode ? '**%' : `${analytics.avgPremiumCaptured.toFixed(0)}%`}</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="stat-label mb-1">Avg Captured</div>
            <div className="text-sm text-muted">of max premium</div>
          </div>
        </div>
      </div>

      {/* ── Cumulative P/L + Strategy Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">Cumulative P/L</h3>
              <button
                onClick={() => setShowBenchmark(!showBenchmark)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  showBenchmark
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-background/30 text-muted border-border/30 hover:text-foreground'
                )}
              >
                {showBenchmark ? 'vs SPY On' : 'vs SPY'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {analytics.biggestWin > 0 && (
                <span className="text-xs text-profit bg-profit/10 px-2 py-1 rounded-lg">
                  Best Trade: {privacyMode ? '$***' : `+${formatCurrency(analytics.biggestWin)}`}
                </span>
              )}
              {analytics.worstTrade < 0 && (
                <span className="text-xs text-loss bg-loss/10 px-2 py-1 rounded-lg">
                  Worst Trade: {privacyMode ? '$***' : formatCurrency(analytics.worstTrade)}
                </span>
              )}
            </div>
          </div>
          <ChartBlur active={privacyMode}>
            {showBenchmark ? (
              <BenchmarkComparisonChart data={(() => {
                const spyData = spyBars.get('SPY') || [];
                const cumData = analytics.cumulativeWithDrawdown;
                if (cumData.length === 0 || spyData.length === 0) return [];

                // Normalize portfolio returns as % of account value
                const accountVal = accountSettings.accountValue || 1;
                const benchmarkData = cumData.map(point => {
                  const portfolioReturn = (point.total / accountVal) * 100;
                  // Find nearest SPY bar by date
                  const pointDate = point.date; // MM/dd format
                  return { date: pointDate, portfolio: portfolioReturn, spy: 0 };
                });

                // Calculate SPY return from first trade date
                if (spyData.length > 0) {
                  const spyStart = spyData[0].c;
                  // Sample SPY at even intervals matching trade count
                  const step = Math.max(1, Math.floor(spyData.length / benchmarkData.length));
                  benchmarkData.forEach((point, i) => {
                    const spyIdx = Math.min(i * step, spyData.length - 1);
                    const spyReturn = ((spyData[spyIdx].c - spyStart) / spyStart) * 100;
                    point.spy = Math.round(spyReturn * 100) / 100;
                  });
                }
                return benchmarkData;
              })()} />
            ) : (
              <CumulativePLWithDrawdownChart data={analytics.cumulativeWithDrawdown} />
            )}
          </ChartBlur>
        </div>
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">P/L by Strategy</h3>
          <ChartBlur active={privacyMode}>
            <StrategyDonutChart data={analytics.strategyPL} centerLabel="Total P/L" onSliceClick={setStrategyTradesModal} />
          </ChartBlur>
        </div>
      </div>

      {/* ── P/L Annotations ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Chart Annotations</h3>
          <button
            onClick={() => setAnnotationInput({ date: new Date().toISOString().slice(0, 10), label: '' })}
            className="text-xs text-accent hover:text-accent-light transition-colors"
          >
            + Add Note
          </button>
        </div>
        {annotationInput && (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="date"
              value={annotationInput.date}
              onChange={e => setAnnotationInput({ ...annotationInput, date: e.target.value })}
              className="input-field text-xs py-1.5 w-36"
            />
            <input
              type="text"
              value={annotationInput.label}
              onChange={e => setAnnotationInput({ ...annotationInput, label: e.target.value })}
              placeholder="e.g. Fed rate decision"
              className="input-field text-xs py-1.5 flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter' && annotationInput.label.trim()) {
                  addAnnotation(annotationInput.date, annotationInput.label.trim());
                  setAnnotationInput(null);
                }
              }}
            />
            <button
              onClick={() => {
                if (annotationInput.label.trim()) {
                  addAnnotation(annotationInput.date, annotationInput.label.trim());
                }
                setAnnotationInput(null);
              }}
              className="text-xs text-accent hover:text-accent-light px-2 py-1.5"
            >
              Save
            </button>
            <button onClick={() => setAnnotationInput(null)} className="text-xs text-muted hover:text-foreground px-1">
              &times;
            </button>
          </div>
        )}
        {annotations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {annotations.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/5 border border-accent/10 text-xs">
                <span className="text-muted">{a.date.slice(5)}</span>
                <span className="text-foreground">{a.label}</span>
                <button onClick={() => deleteAnnotation(a.id)} className="text-muted hover:text-loss ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Monthly P/L by Strategy (full width, best chart) ── */}
      {analytics.monthlyStacked.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Monthly P/L by Strategy</h3>
          <ChartBlur active={privacyMode}>
            <MonthlyStackedChart data={analytics.monthlyStacked} />
          </ChartBlur>
        </div>
      )}

      {/* ── Hold Time Analyzer ── */}
      {analytics.holdTimeStrategies.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-5">Hold Time Analyzer</h3>
          <ChartBlur active={privacyMode}>
            <HoldTimeAnalyzer strategies={analytics.holdTimeStrategies} buckets={analytics.holdTimeBuckets} />
          </ChartBlur>
        </div>
      )}

      {/* ── Tabbed Strategy Breakdown ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-1 mb-5 p-1 bg-card-solid/50 rounded-xl border border-border w-fit">
          {strategyTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStrategyTab(tab.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                strategyTab === tab.key
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
        <ChartBlur active={privacyMode}>
          <StrategyBreakdownContent tab={strategyTab} analytics={analytics} />
        </ChartBlur>
      </div>

      {/* ── P/L by Ticker + Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">P/L by Ticker</h3>
          <ChartBlur active={privacyMode}>
            <PLByTickerChart data={analytics.plByTicker} />
          </ChartBlur>
        </div>
        {analytics.heatmapTrades.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">P/L Heatmap</h3>
            <ChartBlur active={privacyMode}>
              <PLHeatmapCalendar trades={analytics.heatmapTrades} />
            </ChartBlur>
          </div>
        )}
      </div>

      {/* ── P/L Distribution + Days Held Scatter ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics.plDistribution.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">P/L Distribution</h3>
            <p className="text-xs text-muted mb-4">Trade outcomes bucketed by P/L range</p>
            <ChartBlur active={privacyMode}>
              <PLDistributionChart data={analytics.plDistribution} />
            </ChartBlur>
          </div>
        )}
        {analytics.scatterData.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">Days Held vs P/L</h3>
            <p className="text-xs text-muted mb-4">Does holding longer correlate with better outcomes?</p>
            <ChartBlur active={privacyMode}>
              <DaysHeldScatterChart data={analytics.scatterData} />
            </ChartBlur>
          </div>
        )}
      </div>

      {/* ── Trade Frequency + Risk Metrics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Trade Frequency</h3>
          <ChartBlur active={privacyMode}>
            <TradeFrequencyChart data={analytics.tradeFrequency} />
          </ChartBlur>
        </div>
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Streaks</h3>
            <ChartBlur active={privacyMode}>
              <WinLossStreakBar data={analytics.streakData} />
            </ChartBlur>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Risk Metrics</h3>
            <div className="space-y-4">
              <RiskMetricRow
                label="Profit Factor"
                value={privacyMode ? '***' : (analytics.profitFactor === Infinity ? '∞' : analytics.profitFactor.toFixed(2))}
                hint="Gross wins / gross losses"
                variant={analytics.profitFactor >= 1.5 ? 'good' : analytics.profitFactor >= 1 ? 'ok' : 'bad'}
              />
              <RiskMetricRow
                label="Avg Win"
                value={privacyMode ? '$***' : `+${formatCurrency(analytics.avgWin)}`}
                variant="good"
              />
              <RiskMetricRow
                label="Avg Loss"
                value={privacyMode ? '$***' : formatCurrency(analytics.avgLoss)}
                variant="bad"
              />
              <RiskMetricRow
                label="Win/Loss Ratio"
                value={privacyMode ? '***' : (analytics.avgLoss !== 0 ? (analytics.avgWin / Math.abs(analytics.avgLoss)).toFixed(2) : '-')}
                hint="Avg win / avg loss"
                variant={analytics.avgLoss !== 0 && (analytics.avgWin / Math.abs(analytics.avgLoss)) >= 1 ? 'good' : 'bad'}
              />
              <RiskMetricRow
                label="Max Drawdown"
                value={privacyMode ? '$***' : formatCurrency(analytics.maxDrawdown)}
                variant="bad"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Win Rates ── */}
      <div className="glass-card p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">Win Rates by Strategy</h3>
        <ChartBlur active={privacyMode}>
        <WinRateRow
          rates={[
            { label: 'Overall', rate: analytics.overallWinRate, color: '#10b981', count: `${analytics.totalTrades} trades` },
            ...(analytics.cspCount > 0 ? [{ label: 'CSP', rate: analytics.cspWinRate, color: '#10b981', count: `${analytics.cspCount}` }] : []),
            ...(analytics.ccCount > 0 ? [{ label: 'CC', rate: analytics.ccWinRate, color: '#3b82f6', count: `${analytics.ccCount}` }] : []),
            ...(analytics.dirCount > 0 ? [{ label: 'Directional', rate: analytics.dirWinRate, color: '#f59e0b', count: `${analytics.dirCount}` }] : []),
            ...(analytics.spreadCount > 0 ? [{ label: 'Spreads', rate: analytics.spreadWinRate, color: '#a855f7', count: `${analytics.spreadCount}` }] : []),
          ]}
        />
        </ChartBlur>
      </div>

      {/* ── Behavioral Patterns (AI) ── */}
      <BehavioralPatterns timeRange={timeRange} />

      {/* ── Strategy Trades Modal ── */}
      {strategyTradesModal && analytics.strategyTrades[strategyTradesModal] && (
        <StrategyTradesModal
          name={strategyTradesModal}
          trades={analytics.strategyTrades[strategyTradesModal]}
          color={analytics.strategyPL.find(s => s.name === strategyTradesModal)?.color || '#10b981'}
          onClose={() => setStrategyTradesModal(null)}
        />
      )}
    </div>
  );
}

// ─── Chart Blur Overlay ───

function ChartBlur({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <div className="relative">
      <div className="blur-md pointer-events-none select-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card-solid/80 border border-border/50 backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <span className="text-sm text-muted font-medium">Hidden</span>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Stat Card ───

const COLORS = {
  accent: '#10b981',
  profit: '#22c55e',
  loss: '#ef4444',
};

function HeroStat({ label, value, variant, sub }: { label: string; value: string; variant: 'profit' | 'loss'; sub?: string }) {
  return (
    <div className={cn(
      'glass-card p-5 transition-all duration-300',
      variant === 'profit' ? 'hover:border-profit/20 shadow-[0_0_30px_rgba(16,185,129,0.06)]' : 'hover:border-loss/20 shadow-[0_0_30px_rgba(239,68,68,0.06)]',
    )}>
      <div className="stat-label mb-2">{label}</div>
      <div className={cn('stat-value', variant === 'profit' ? 'text-profit' : 'text-loss')}>{value}</div>
      {sub && <div className="text-muted text-sm mt-1">{sub}</div>}
    </div>
  );
}

// ─── Time Range Selector ───

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const ranges: TimeRange[] = ['1W', '1M', '3M', '6M', 'YTD', 'ALL'];
  return (
    <div className="flex items-center gap-1 p-1 bg-card-solid/50 rounded-xl border border-border">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            value === r
              ? 'bg-accent/10 text-accent'
              : 'text-muted hover:text-foreground'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Risk Metric Row ───

function RiskMetricRow({ label, value, hint, variant }: { label: string; value: string; hint?: string; variant: 'good' | 'ok' | 'bad' }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted/60">{hint}</div>}
      </div>
      <span className={cn(
        'text-sm font-bold',
        variant === 'good' ? 'text-profit' : variant === 'ok' ? 'text-caution' : 'text-loss'
      )}>
        {value}
      </span>
    </div>
  );
}

// ─── Tabbed Strategy Breakdown ───

// AnalyticsData and TradeWithPL types imported from useAnalyticsData hook

interface StrategyConfig {
  label: string; icon: string; iconBg: string; iconColor: string;
  pl: number; winRate: number; count: number; avgDays: number;
  best: TradeWithPL | null; worst: TradeWithPL | null;
  formatDetails: (t: TradeWithPL) => string;
  stats: { label: string; value: string; variant?: boolean }[];
}

function StrategyBreakdownContent({ tab, analytics }: { tab: StrategyTab; analytics: AnalyticsData }) {
  if (tab === 'all') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {analytics.cspCount > 0 && (
          <StrategyMiniCard
            label="Cash-Secured Puts"
            icon="P"
            iconBg="bg-accent/10"
            iconColor="text-accent"
            pl={analytics.cspTotalPL}
            winRate={analytics.cspWinRate}
            count={analytics.cspCount}
            avgDays={analytics.cspAvgDaysHeld}
            captured={analytics.cspAvgPremiumCaptured}
          />
        )}
        {analytics.ccCount > 0 && (
          <StrategyMiniCard
            label="Covered Calls"
            icon="C"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-400"
            pl={analytics.ccTotalPL}
            winRate={analytics.ccWinRate}
            count={analytics.ccCount}
            avgDays={analytics.ccAvgDaysHeld}
            captured={analytics.ccAvgPremiumCaptured}
          />
        )}
        {analytics.dirCount > 0 && (
          <StrategyMiniCard
            label="Directional"
            icon="D"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-400"
            pl={analytics.dirTotalPL}
            winRate={analytics.dirWinRate}
            count={analytics.dirCount}
            avgDays={analytics.dirAvgDaysHeld}
            captured={undefined}
          />
        )}
        {analytics.spreadCount > 0 && (
          <StrategyMiniCard
            label="Spreads"
            icon="S"
            iconBg="bg-purple-500/10"
            iconColor="text-purple-400"
            pl={analytics.spreadTotalPL}
            winRate={analytics.spreadWinRate}
            count={analytics.spreadCount}
            avgDays={analytics.spreadAvgDaysHeld}
            captured={analytics.spreadAvgPremiumCaptured}
          />
        )}
        {analytics.stockCount > 0 && (
          <div className="bg-card-solid/30 rounded-xl p-5 border border-border/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-500/10">
                <span className="font-bold text-sm text-teal-400">$</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Stock Capital Gains</span>
                <div className="text-xs text-muted">{analytics.stockCount} sales</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted mb-1">Total P/L</div>
                <div className={cn('text-2xl font-bold', analytics.stockTotalPL >= 0 ? 'text-profit' : 'text-loss')}>
                  {analytics.stockTotalPL >= 0 ? '+' : ''}{rawFormatCurrency(analytics.stockTotalPL)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-foreground">{analytics.stockWinRate.toFixed(0)}%</div>
              </div>
            </div>
            {analytics.stockBestEvent && (
              <div className="flex items-center justify-between text-sm text-muted pt-3 border-t border-border/20">
                <span>Largest gain</span>
                <span className="text-profit">{analytics.stockBestEvent.ticker} +{rawFormatCurrency(analytics.stockBestEvent.realizedPL)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Individual strategy tab
  const configs: Record<string, StrategyConfig> = {
    csp: {
      label: 'Cash-Secured Puts', icon: 'P', iconBg: 'bg-accent/10', iconColor: 'text-accent',
      pl: analytics.cspTotalPL, winRate: analytics.cspWinRate, count: analytics.cspCount,
      avgDays: analytics.cspAvgDaysHeld, best: analytics.cspBestTrade, worst: analytics.cspWorstTrade,
      formatDetails: (t: TradeWithPL) => `${t.ticker} $${t.strike}P x ${t.contracts}`,
      stats: [
        { label: 'Total P/L', value: `${analytics.cspTotalPL >= 0 ? '+' : ''}${rawFormatCurrency(analytics.cspTotalPL)}`, variant: analytics.cspTotalPL >= 0 },
        { label: 'Win Rate', value: `${analytics.cspWinRate.toFixed(0)}%` },
        { label: 'Avg Captured', value: `${analytics.cspAvgPremiumCaptured.toFixed(0)}%` },
        { label: 'Avg Hold', value: `${analytics.cspAvgDaysHeld.toFixed(0)}d` },
      ],
    },
    cc: {
      label: 'Covered Calls', icon: 'C', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400',
      pl: analytics.ccTotalPL, winRate: analytics.ccWinRate, count: analytics.ccCount,
      avgDays: analytics.ccAvgDaysHeld, best: analytics.ccBestTrade, worst: analytics.ccWorstTrade,
      formatDetails: (t: TradeWithPL) => `${t.ticker} $${t.strike}C x ${t.contracts}`,
      stats: [
        { label: 'Total P/L', value: `${analytics.ccTotalPL >= 0 ? '+' : ''}${rawFormatCurrency(analytics.ccTotalPL)}`, variant: analytics.ccTotalPL >= 0 },
        { label: 'Win Rate', value: `${analytics.ccWinRate.toFixed(0)}%` },
        { label: 'Avg Captured', value: `${analytics.ccAvgPremiumCaptured.toFixed(0)}%` },
        { label: 'Avg Hold', value: `${analytics.ccAvgDaysHeld.toFixed(0)}d` },
      ],
    },
    directional: {
      label: 'Directional', icon: 'D', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400',
      pl: analytics.dirTotalPL, winRate: analytics.dirWinRate, count: analytics.dirCount,
      avgDays: analytics.dirAvgDaysHeld, best: analytics.dirBestTrade, worst: analytics.dirWorstTrade,
      formatDetails: (t: TradeWithPL) => `${t.ticker} $${t.strike}${t.optionType === 'call' ? 'C' : 'P'} x ${t.contracts}`,
      stats: [
        { label: 'Total P/L', value: `${analytics.dirTotalPL >= 0 ? '+' : ''}${rawFormatCurrency(analytics.dirTotalPL)}`, variant: analytics.dirTotalPL >= 0 },
        { label: 'Win Rate', value: `${analytics.dirWinRate.toFixed(0)}%` },
        { label: 'Total Return', value: `${analytics.dirTotalReturn >= 0 ? '+' : ''}${analytics.dirTotalReturn.toFixed(1)}%` },
        { label: 'Avg Hold', value: `${analytics.dirAvgDaysHeld.toFixed(0)}d` },
      ],
    },
    spreads: {
      label: 'Spreads', icon: 'S', iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400',
      pl: analytics.spreadTotalPL, winRate: analytics.spreadWinRate, count: analytics.spreadCount,
      avgDays: analytics.spreadAvgDaysHeld, best: analytics.spreadBestTrade, worst: analytics.spreadWorstTrade,
      formatDetails: (t: TradeWithPL) => `${t.ticker} $${t.longStrike}/$${t.shortStrike} x ${t.contracts}`,
      stats: [
        { label: 'Total P/L', value: `${analytics.spreadTotalPL >= 0 ? '+' : ''}${rawFormatCurrency(analytics.spreadTotalPL)}`, variant: analytics.spreadTotalPL >= 0 },
        { label: 'Win Rate', value: `${analytics.spreadWinRate.toFixed(0)}%` },
        { label: 'Avg Captured', value: `${analytics.spreadAvgPremiumCaptured.toFixed(0)}%` },
        { label: 'Avg Hold', value: `${analytics.spreadAvgDaysHeld.toFixed(0)}d` },
      ],
    },
  };

  const config = configs[tab];
  if (!config || config.count === 0) return <div className="text-center text-muted py-8">No data for this strategy</div>;

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {config.stats.map((s: { label: string; value: string; variant?: boolean }) => (
          <div key={s.label} className="bg-card-solid/30 rounded-xl p-4 border border-border/30">
            <div className="stat-label mb-1">{s.label}</div>
            <div className={cn(
              'text-xl font-bold',
              s.variant === true ? 'text-profit' : s.variant === false ? 'text-loss' : 'text-foreground'
            )}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Best / Worst */}
      {(config.best || config.worst) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.best && (
            <BestWorstCard type="best" trade={config.best} formatDetails={config.formatDetails} iconBg={config.iconBg} iconColor={config.iconColor} />
          )}
          {config.worst && (
            <BestWorstCard type="worst" trade={config.worst} formatDetails={config.formatDetails} iconBg={config.iconBg} iconColor={config.iconColor} />
          )}
        </div>
      )}
    </div>
  );
}

function StrategyMiniCard({ label, icon, iconBg, iconColor, pl, winRate, count, avgDays, captured }: {
  label: string; icon: string; iconBg: string; iconColor: string;
  pl: number; winRate: number; count: number; avgDays: number; captured?: number;
}) {
  return (
    <div className="bg-card-solid/30 rounded-xl p-6 border border-border/30 space-y-5">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconBg)}>
          <span className={cn('font-bold text-sm', iconColor)}>{icon}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">{label}</span>
          <div className="text-xs text-muted">{count} trades</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted mb-1">Total P/L</div>
          <div className={cn('text-2xl font-bold', pl >= 0 ? 'text-profit' : 'text-loss')}>
            {pl >= 0 ? '+' : ''}{rawFormatCurrency(pl)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-foreground">{winRate.toFixed(0)}%</div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
      <div className="flex justify-between items-center">
        {captured != null ? (
          <div>
            <span className={cn('font-semibold', captured >= 50 ? 'text-profit' : 'text-loss')}>
              {captured.toFixed(0)}% captured
            </span>
          </div>
        ) : <div />}
        <div className="text-sm text-muted">
          Avg {avgDays.toFixed(0)}d hold
        </div>
      </div>
    </div>
  );
}

function BestWorstCard({ type, trade, formatDetails, iconBg, iconColor }: {
  type: 'best' | 'worst'; trade: TradeWithPL; formatDetails: (t: TradeWithPL) => string;
  iconBg: string; iconColor: string;
}) {
  const isBest = type === 'best';
  const isPositive = trade.pl >= 0;

  return (
    <div className="bg-card-solid/30 rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', isBest ? 'bg-profit/10' : isPositive ? 'bg-profit/10' : 'bg-loss/10')}>
          <span className={cn('text-sm', isBest ? 'text-profit' : isPositive ? 'text-profit' : 'text-loss')}>
            {isBest ? '↑' : isPositive ? '↑' : '↓'}
          </span>
        </div>
        <span className="text-xs text-muted font-medium">{isBest ? 'Best' : 'Worst'} Trade</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconBg)}>
            <span className={cn('font-bold text-xs', iconColor)}>{trade.ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">{trade.ticker}</div>
            <div className="text-muted text-xs">{formatDetails(trade)}</div>
          </div>
        </div>
        <span className={cn('text-xl font-bold', isPositive ? 'text-profit' : 'text-loss')}>
          {isPositive ? '+' : ''}{rawFormatCurrency(trade.pl)}
        </span>
      </div>
    </div>
  );
}

// ─── Strategy Trades Modal ───

function StrategyTradesModal({ name, trades, color, onClose }: {
  name: string; trades: TradeWithPL[]; color: string; onClose: () => void;
}) {
  const [sortBy, setSortBy] = useState<'pl' | 'date' | 'ticker'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [plFilter, setPLFilter] = useState<'all' | 'wins' | 'losses'>('all');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSort = (key: 'pl' | 'date' | 'ticker') => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const filteredTrades = plFilter === 'all' ? trades
    : plFilter === 'wins' ? trades.filter(t => t.pl > 0)
    : trades.filter(t => t.pl <= 0);

  const sorted = [...filteredTrades].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'pl') return (a.pl - b.pl) * dir;
    if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker) * dir;
    return ((a.exitDate || '').localeCompare(b.exitDate || '')) * dir;
  });

  const totalPL = trades.reduce((s, t) => s + t.pl, 0);
  const wins = trades.filter(t => t.pl > 0).length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const avgPL = trades.length > 0 ? totalPL / trades.length : 0;
  const getBarPercent = (t: TradeWithPL) => {
    const premium = t.premiumCollected ?? t.maxProfit;
    if (premium && premium > 0) return Math.min(Math.abs(t.pl) / premium * 100, 100);
    return Math.min(Math.abs(t.plPercent), 100);
  };
  const bestTrade = trades.length > 0 ? trades.reduce((b, t) => t.pl > b.pl ? t : b) : null;
  const worstTrade = trades.length > 0 ? trades.reduce((w, t) => t.pl < w.pl ? t : w) : null;

  const SortBtn = ({ label, field }: { label: string; field: 'pl' | 'date' | 'ticker' }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn('text-left stat-label cursor-pointer hover:text-foreground transition-colors', sortBy === field && 'text-accent')}
    >
      {label} {sortBy === field && (sortDir === 'asc' ? '↑' : '↓')}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-card-solid rounded-2xl border border-border/50 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-lg font-semibold text-foreground">{name}</h2>
            <span className="text-xs text-muted bg-background/50 px-2 py-0.5 rounded-full">{trades.length} trades</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-b border-border/30">
          <div>
            <div className="stat-label mb-1">Total P/L</div>
            <div className={cn('text-xl font-bold', totalPL >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPL >= 0 ? '+' : ''}{rawFormatCurrency(totalPL)}
            </div>
          </div>
          <div>
            <div className="stat-label mb-1">Win Rate</div>
            <div className="text-xl font-bold text-foreground">{winRate.toFixed(0)}%</div>
          </div>
          <div>
            <div className="stat-label mb-1">Avg P/L</div>
            <div className={cn('text-xl font-bold', avgPL >= 0 ? 'text-profit' : 'text-loss')}>
              {avgPL >= 0 ? '+' : ''}{rawFormatCurrency(avgPL)}
            </div>
          </div>
          <div>
            <div className="stat-label mb-1">Best / Worst</div>
            <div className="text-sm">
              <span className="text-profit font-semibold">{bestTrade ? `${bestTrade.pl >= 0 ? '+' : ''}${rawFormatCurrency(bestTrade.pl)}` : '—'}</span>
              <span className="text-muted mx-1">/</span>
              <span className="text-loss font-semibold">{worstTrade ? `${worstTrade.pl >= 0 ? '+' : ''}${rawFormatCurrency(worstTrade.pl)}` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-2">
          {([['all', `All (${trades.length})`], ['wins', `Wins (${wins})`], ['losses', `Losses (${losses})`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPLFilter(key)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                plFilter === key ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-5 pb-5">
          <table className="w-full">
            <thead>
              <tr className="text-xs">
                <th className="pb-2 pr-3"><SortBtn label="Ticker" field="ticker" /></th>
                <th className="pb-2 pr-3 text-left stat-label">Details</th>
                <th className="pb-2 pr-3"><SortBtn label="Exit Date" field="date" /></th>
                <th className="pb-2 pr-3 text-left stat-label">Days</th>
                <th className="pb-2 text-right" colSpan={2}><SortBtn label="P/L" field="pl" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sorted.map((t, i) => (
                <tr key={i} className="hover:bg-background/20 transition-colors group">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-foreground text-sm">{t.ticker}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted">
                    {t.strike != null && `$${t.strike}`}
                    {t.optionType === 'call' ? 'C' : t.optionType === 'put' ? 'P' : t.strike != null ? (t.type === 'cc' ? 'C' : 'P') : ''}
                    {t.longStrike != null && t.shortStrike != null && ` $${t.longStrike}/$${t.shortStrike}`}
                    {t.contracts != null && t.contracts > 0 && ` x${t.contracts}`}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted">
                    {t.exitDate ? new Date(t.exitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted">
                    {t.daysHeld > 0 ? `${t.daysHeld}d` : '—'}
                  </td>
                  <td className={cn('py-2.5 text-right text-sm font-semibold whitespace-nowrap', t.pl >= 0 ? 'text-profit' : 'text-loss')}>
                    {t.pl >= 0 ? '+' : ''}{rawFormatCurrency(t.pl)}
                    {t.plPercent !== 0 && (
                      <span className="text-[10px] font-normal text-muted ml-1">
                        ({t.plPercent >= 0 ? '+' : ''}{t.plPercent.toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 w-16">
                    <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', t.pl >= 0 ? 'bg-profit/60' : 'bg-loss/60')}
                        style={{ width: `${getBarPercent(t)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="text-center py-6 text-muted text-sm">No {plFilter === 'wins' ? 'winning' : 'losing'} trades</div>
          )}
        </div>
      </div>
    </div>
  );
}
