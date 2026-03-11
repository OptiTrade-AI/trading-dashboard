'use client';

import { useMemo, useState } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useCoveredCalls, calculateCCPL, calculateCCPLPercent } from '@/hooks/useCoveredCalls';
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
import {
  formatCurrency as rawFormatCurrency,
  calculatePL,
  calculatePLPercent,
  calculateDaysHeld,
  calculateDirectionalPL,
  calculateDirectionalPLPercent,
  calculateSpreadPL,
  calculateSpreadPLPercent,
} from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { format, parse, parseISO, startOfMonth, isThisMonth, isThisYear, subMonths, subDays, startOfYear, isAfter } from 'date-fns';

type TimeRange = '1M' | '3M' | '6M' | 'YTD' | 'ALL';
type StrategyTab = 'all' | 'csp' | 'cc' | 'directional' | 'spreads';

export default function Analytics() {
  const { closedTrades, accountSettings } = useTrades();
  const { closedCalls } = useCoveredCalls();
  const { closedTrades: closedDirectional } = useDirectionalTrades();
  const { closedSpreads } = useSpreads();
  const { stockEvents } = useStockEvents();
  const [includeStockPL, setIncludeStockPL] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [strategyTab, setStrategyTab] = useState<StrategyTab>('all');
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [annotationInput, setAnnotationInput] = useState<{ date: string; label: string } | null>(null);
  const { formatCurrency, privacyMode } = useFormatters();
  const { allBars: spyBars } = useStockAggregates(showBenchmark ? ['SPY'] : []);
  const { annotations, addAnnotation, deleteAnnotation } = useAnnotations();

  const analytics = useMemo(() => {
    // Time range filter
    const now = new Date();
    const cutoff =
      timeRange === '1M'
        ? subMonths(now, 1)
        : timeRange === '3M'
        ? subMonths(now, 3)
        : timeRange === '6M'
        ? subMonths(now, 6)
        : timeRange === 'YTD'
        ? startOfYear(now)
        : null;

    const filterByDate = <T extends { exitDate?: string }>(items: T[]) => {
      if (!cutoff) return items;
      return items.filter((t) => t.exitDate && isAfter(parseISO(t.exitDate), cutoff));
    };

    const filteredCSP = filterByDate(closedTrades);
    const filteredCC = filterByDate(closedCalls);
    const filteredDir = filterByDate(closedDirectional);
    const filteredSpreads = filterByDate(closedSpreads);

    // Stock events filtered by saleDate
    const filteredStockEvents = cutoff
      ? stockEvents.filter(e => isAfter(parseISO(e.saleDate), cutoff))
      : stockEvents;
    const filteredStockPL = includeStockPL
      ? filteredStockEvents.reduce((sum, e) => sum + e.realizedPL, 0)
      : 0;

    if (filteredCSP.length === 0 && filteredCC.length === 0 && filteredDir.length === 0 && filteredSpreads.length === 0) {
      return null;
    }

    // CSP Analytics
    const cspWithPL = filteredCSP.map((t) => ({
      ...t,
      type: 'csp' as const,
      pl: calculatePL(t),
      plPercent: calculatePLPercent(t),
      daysHeld: calculateDaysHeld(t),
    }));

    const cspTotalPL = cspWithPL.reduce((sum, t) => sum + t.pl, 0);
    const cspWinning = cspWithPL.filter((t) => t.pl > 0).length;
    const cspWinRate = cspWithPL.length > 0 ? (cspWinning / cspWithPL.length) * 100 : 0;
    const cspAvgReturn = cspWithPL.length > 0
      ? cspWithPL.reduce((sum, t) => sum + t.plPercent, 0) / cspWithPL.length
      : 0;
    const cspAvgDaysHeld = cspWithPL.length > 0
      ? cspWithPL.reduce((sum, t) => sum + t.daysHeld, 0) / cspWithPL.length
      : 0;

    const sortedCSP = [...cspWithPL].sort((a, b) => b.pl - a.pl);
    const cspBestTrade = sortedCSP[0] || null;
    const cspWorstTrade = sortedCSP[sortedCSP.length - 1] || null;

    // CC Analytics
    const ccWithPL = filteredCC.map((c) => ({
      ...c,
      type: 'cc' as const,
      pl: calculateCCPL(c),
      plPercent: calculateCCPLPercent(c),
      daysHeld: calculateDaysHeld({ entryDate: c.entryDate, exitDate: c.exitDate }),
    }));

    const ccTotalPL = ccWithPL.reduce((sum, c) => sum + c.pl, 0);
    const ccWinning = ccWithPL.filter((c) => c.pl > 0).length;
    const ccWinRate = ccWithPL.length > 0 ? (ccWinning / ccWithPL.length) * 100 : 0;
    const ccCalledAway = filteredCC.filter((c) => c.status === 'called').length;
    const ccAvgDaysHeld = ccWithPL.length > 0
      ? ccWithPL.reduce((sum, c) => sum + c.daysHeld, 0) / ccWithPL.length
      : 0;

    const sortedCC = [...ccWithPL].sort((a, b) => b.pl - a.pl);
    const ccBestTrade = sortedCC[0] || null;
    const ccWorstTrade = sortedCC[sortedCC.length - 1] || null;

    // Directional Analytics
    const dirWithPL = filteredDir.map((t) => ({
      ...t,
      type: 'directional' as const,
      pl: calculateDirectionalPL(t),
      plPercent: calculateDirectionalPLPercent(t),
      daysHeld: calculateDaysHeld({ entryDate: t.entryDate, exitDate: t.exitDate }),
    }));

    const dirTotalPL = dirWithPL.reduce((sum, t) => sum + t.pl, 0);
    const dirWinning = dirWithPL.filter((t) => t.pl > 0).length;
    const dirWinRate = dirWithPL.length > 0 ? (dirWinning / dirWithPL.length) * 100 : 0;
    const dirTotalCost = filteredDir.reduce((sum, t) => sum + t.costAtOpen, 0);
    const dirTotalReturn = dirTotalCost > 0 ? (dirTotalPL / dirTotalCost) * 100 : 0;
    const dirAvgDaysHeld = dirWithPL.length > 0
      ? dirWithPL.reduce((sum, t) => sum + t.daysHeld, 0) / dirWithPL.length
      : 0;

    const sortedDir = [...dirWithPL].sort((a, b) => b.pl - a.pl);
    const dirBestTrade = sortedDir[0] || null;
    const dirWorstTrade = sortedDir[sortedDir.length - 1] || null;

    // Spread Analytics
    const spreadWithPL = filteredSpreads.map((t) => ({
      ...t,
      type: 'spread' as const,
      pl: calculateSpreadPL(t),
      plPercent: calculateSpreadPLPercent(t),
      daysHeld: calculateDaysHeld({ entryDate: t.entryDate, exitDate: t.exitDate }),
    }));

    const spreadTotalPL = spreadWithPL.reduce((sum, t) => sum + t.pl, 0);
    const spreadWinning = spreadWithPL.filter((t) => t.pl > 0).length;
    const spreadWinRate = spreadWithPL.length > 0 ? (spreadWinning / spreadWithPL.length) * 100 : 0;
    const spreadCapitalAtRisk = filteredSpreads.reduce((sum, t) => sum + t.maxLoss, 0);
    const spreadTotalReturn = spreadCapitalAtRisk > 0 ? (spreadTotalPL / spreadCapitalAtRisk) * 100 : 0;
    const spreadAvgDaysHeld = spreadWithPL.length > 0
      ? spreadWithPL.reduce((sum, t) => sum + t.daysHeld, 0) / spreadWithPL.length
      : 0;

    const sortedSpread = [...spreadWithPL].sort((a, b) => b.pl - a.pl);
    const spreadBestTrade = sortedSpread[0] || null;
    const spreadWorstTrade = sortedSpread[sortedSpread.length - 1] || null;

    // Combined metrics
    const allTrades = [...cspWithPL, ...ccWithPL, ...dirWithPL, ...spreadWithPL];
    const totalPL = cspTotalPL + ccTotalPL + dirTotalPL + spreadTotalPL + filteredStockPL;
    const totalTrades = allTrades.length;

    const thisMonthPL = allTrades
      .filter((t) => t.exitDate && isThisMonth(parseISO(t.exitDate)))
      .reduce((sum, t) => sum + t.pl, 0);

    const thisYearPL = allTrades
      .filter((t) => t.exitDate && isThisYear(parseISO(t.exitDate)))
      .reduce((sum, t) => sum + t.pl, 0) + filteredStockPL;

    const avgPLPerTrade = totalTrades > 0 ? (cspTotalPL + ccTotalPL + dirTotalPL + spreadTotalPL) / totalTrades : 0;
    const totalPremiumCollected = [...filteredCSP, ...filteredCC].reduce(
      (sum, t) => sum + t.premiumCollected, 0
    );
    const returnOnAccount = accountSettings.accountValue > 0
      ? ((cspTotalPL + ccTotalPL + dirTotalPL + spreadTotalPL + filteredStockPL) / accountSettings.accountValue) * 100
      : 0;

    // Cumulative P/L with drawdown overlay
    const sortedAllByDate = [...allTrades]
      .filter((t) => t.exitDate)
      .sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));
    let runningTotal = 0;
    let peak = 0;
    const cumulativeWithDrawdown = sortedAllByDate.map((t) => {
      runningTotal += t.pl;
      if (runningTotal > peak) peak = runningTotal;
      const drawdown = runningTotal - peak;
      return {
        date: format(parseISO(t.exitDate!), 'MM/dd'),
        total: Math.round(runningTotal * 100) / 100,
        drawdown,
        trade: `${t.ticker} ${t.type === 'csp' ? 'P' : t.type === 'cc' ? 'C' : t.type === 'spread' ? 'S' : 'D'}`,
      };
    });

    // P/L by Ticker
    const plByTickerMap = new Map<string, number>();
    allTrades.forEach((t) => {
      const current = plByTickerMap.get(t.ticker) || 0;
      plByTickerMap.set(t.ticker, current + t.pl);
    });
    const plByTicker = Array.from(plByTickerMap.entries())
      .map(([ticker, pl]) => ({ ticker, pl }))
      .sort((a, b) => b.pl - a.pl);

    // Monthly P/L by Strategy (stacked)
    const monthlyStackedMap = new Map<string, { csp: number; cc: number; directional: number; spreads: number }>();
    allTrades.forEach((t) => {
      if (t.exitDate) {
        const month = format(startOfMonth(parseISO(t.exitDate)), 'MMM yyyy');
        if (!monthlyStackedMap.has(month)) {
          monthlyStackedMap.set(month, { csp: 0, cc: 0, directional: 0, spreads: 0 });
        }
        const entry = monthlyStackedMap.get(month)!;
        if (t.type === 'csp') entry.csp += t.pl;
        else if (t.type === 'cc') entry.cc += t.pl;
        else if (t.type === 'directional') entry.directional += t.pl;
        else if (t.type === 'spread') entry.spreads += t.pl;
      }
    });
    const monthlyStacked = Array.from(monthlyStackedMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => {
        const dateA = parse(a.month, 'MMM yyyy', new Date());
        const dateB = parse(b.month, 'MMM yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      });

    // Trade Frequency
    const frequencyMap = new Map<string, number>();
    allTrades.forEach((t) => {
      if (t.exitDate) {
        const month = format(startOfMonth(parseISO(t.exitDate)), 'MMM yyyy');
        const current = frequencyMap.get(month) || 0;
        frequencyMap.set(month, current + 1);
      }
    });
    const tradeFrequency = Array.from(frequencyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const dateA = parse(a.month, 'MMM yyyy', new Date());
        const dateB = parse(b.month, 'MMM yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      });

    // Strategy donut data
    const strategyPL = [
      { name: 'CSPs', value: Math.abs(cspTotalPL), color: '#10b981' },
      { name: 'Covered Calls', value: Math.abs(ccTotalPL), color: '#3b82f6' },
      { name: 'Directional', value: Math.abs(dirTotalPL), color: '#f59e0b' },
      { name: 'Spreads', value: Math.abs(spreadTotalPL), color: '#a855f7' },
    ].filter((d) => d.value > 0);

    // Heatmap trades
    const heatmapTrades = allTrades
      .filter((t) => t.exitDate)
      .map((t) => ({ exitDate: t.exitDate!, pl: t.pl }));

    // Overall win rate
    const overallWinning = allTrades.filter((t) => t.pl > 0).length;
    const overallWinRate = totalTrades > 0 ? (overallWinning / totalTrades) * 100 : 0;

    // P/L Distribution
    const allPLs = allTrades.map((t) => t.pl);
    const minPL = Math.min(...allPLs);
    const maxPL = Math.max(...allPLs);
    const bucketSize = Math.max(50, Math.ceil((maxPL - minPL) / 10 / 50) * 50);
    const bucketStart = Math.floor(minPL / bucketSize) * bucketSize;
    const bucketEnd = Math.ceil(maxPL / bucketSize) * bucketSize;
    const plDistribution: { range: string; count: number; isProfit: boolean }[] = [];
    for (let b = bucketStart; b < bucketEnd; b += bucketSize) {
      const count = allPLs.filter((pl) => pl >= b && pl < b + bucketSize).length;
      if (count > 0) {
        const fmtVal = (v: number) => v < 0 ? `-$${Math.abs(v)}` : `$${v}`;
        plDistribution.push({
          range: `${fmtVal(b)} to ${fmtVal(b + bucketSize)}`,
          count,
          isProfit: b >= 0,
        });
      }
    }

    // Days Held vs P/L scatter data
    const scatterData = allTrades.map((t) => ({
      daysHeld: t.daysHeld,
      pl: Math.round(t.pl * 100) / 100,
      ticker: t.ticker,
      type: t.type,
    }));

    // Streak data
    const sortedByExit = [...allTrades]
      .filter((t) => t.exitDate)
      .sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));
    let currentStreak = 0;
    let currentStreakType: 'win' | 'loss' | 'none' = 'none';
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWin = 0;
    let tempLoss = 0;
    sortedByExit.forEach((t) => {
      if (t.pl > 0) {
        tempWin++;
        tempLoss = 0;
        if (tempWin > longestWinStreak) longestWinStreak = tempWin;
      } else if (t.pl < 0) {
        tempLoss++;
        tempWin = 0;
        if (tempLoss > longestLossStreak) longestLossStreak = tempLoss;
      } else {
        tempWin = 0;
        tempLoss = 0;
      }
    });
    if (tempWin > 0) { currentStreak = tempWin; currentStreakType = 'win'; }
    else if (tempLoss > 0) { currentStreak = tempLoss; currentStreakType = 'loss'; }
    const streakData = { currentStreak, currentStreakType, longestWinStreak, longestLossStreak };

    // Rolling 30-day P/L
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentTrades = sortedByExit.filter((t) => t.exitDate && isAfter(parseISO(t.exitDate), thirtyDaysAgo));
    let rollingTotal = 0;
    const rollingPLData = recentTrades.map((t) => {
      rollingTotal += t.pl;
      return { date: format(parseISO(t.exitDate!), 'MM/dd'), total: Math.round(rollingTotal * 100) / 100 };
    });
    const rolling30DayPL = recentTrades.reduce((sum, t) => sum + t.pl, 0);

    // Risk metrics
    const wins = allTrades.filter((t) => t.pl > 0);
    const losses = allTrades.filter((t) => t.pl < 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pl, 0) / losses.length : 0;
    const grossWins = wins.reduce((s, t) => s + t.pl, 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pl, 0));
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
    const maxDrawdown = Math.min(...cumulativeWithDrawdown.map((d) => d.drawdown), 0);
    const biggestWin = allTrades.length > 0 ? Math.max(...allTrades.map((t) => t.pl)) : 0;
    const worstTrade = allTrades.length > 0 ? Math.min(...allTrades.map((t) => t.pl)) : 0;

    // Hold Time Analyzer data
    const buildStrategyHoldTime = (label: string, color: string, trades: { daysHeld: number }[]) => {
      if (trades.length === 0) return null;
      const days = trades.map((t) => t.daysHeld);
      return {
        label,
        color,
        min: Math.min(...days),
        avg: days.reduce((s, d) => s + d, 0) / days.length,
        max: Math.max(...days),
        count: trades.length,
      };
    };
    const holdTimeStrategies = [
      buildStrategyHoldTime('CSP', '#10b981', cspWithPL),
      buildStrategyHoldTime('Covered Calls', '#3b82f6', ccWithPL),
      buildStrategyHoldTime('Directional', '#f59e0b', dirWithPL),
      buildStrategyHoldTime('Spreads', '#a855f7', spreadWithPL),
    ].filter(Boolean) as { label: string; color: string; min: number; avg: number; max: number; count: number }[];

    const holdBucketDefs = [
      { label: '1–3d', range: '1 to 3 days', min: 0, max: 3 },
      { label: '4–7d', range: '4 to 7 days', min: 4, max: 7 },
      { label: '8–14d', range: '1 to 2 weeks', min: 8, max: 14 },
      { label: '15–30d', range: '2 to 4 weeks', min: 15, max: 30 },
      { label: '30d+', range: 'Over 30 days', min: 31, max: Infinity },
    ];
    const holdTimeBuckets = holdBucketDefs.map((def) => {
      const bucket = allTrades.filter((t) => t.daysHeld >= def.min && t.daysHeld <= def.max);
      const wins = bucket.filter((t) => t.pl > 0).length;
      return {
        label: def.label,
        range: def.range,
        trades: bucket.length,
        winRate: bucket.length > 0 ? (wins / bucket.length) * 100 : 0,
        avgPL: bucket.length > 0 ? bucket.reduce((s, t) => s + t.pl, 0) / bucket.length : 0,
      };
    });

    return {
      totalPL,
      thisMonthPL,
      thisYearPL,
      totalTrades,
      avgPLPerTrade,
      totalPremiumCollected,
      returnOnAccount,
      cumulativeWithDrawdown,
      cspTotalPL,
      cspWinRate,
      cspAvgReturn,
      cspAvgDaysHeld,
      cspBestTrade,
      cspWorstTrade,
      cspCount: filteredCSP.length,
      ccTotalPL,
      ccWinRate,
      ccCalledAway,
      ccAvgDaysHeld,
      ccBestTrade,
      ccWorstTrade,
      ccCount: filteredCC.length,
      dirTotalPL,
      dirWinRate,
      dirTotalReturn,
      dirTotalCost,
      dirAvgDaysHeld,
      dirBestTrade,
      dirWorstTrade,
      dirCount: filteredDir.length,
      spreadTotalPL,
      spreadWinRate,
      spreadTotalReturn,
      spreadCapitalAtRisk,
      spreadAvgDaysHeld,
      spreadBestTrade,
      spreadWorstTrade,
      spreadCount: filteredSpreads.length,
      plByTicker,
      monthlyStacked,
      tradeFrequency,
      strategyPL,
      heatmapTrades,
      overallWinRate,
      plDistribution,
      scatterData,
      streakData,
      rollingPLData,
      rolling30DayPL,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      biggestWin,
      worstTrade,
      holdTimeStrategies,
      holdTimeBuckets,
    };
  }, [closedTrades, closedCalls, closedDirectional, closedSpreads, stockEvents, includeStockPL, timeRange, accountSettings.accountValue]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          label="Total P/L"
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
            <StrategyDonutChart data={analytics.strategyPL} centerLabel="Total P/L" />
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
  const ranges: TimeRange[] = ['1M', '3M', '6M', 'YTD', 'ALL'];
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

interface AnalyticsData {
  cspTotalPL: number; cspWinRate: number; cspCount: number; cspAvgDaysHeld: number; cspAvgReturn: number;
  cspBestTrade: TradeWithPL | null; cspWorstTrade: TradeWithPL | null;
  ccTotalPL: number; ccWinRate: number; ccCount: number; ccAvgDaysHeld: number; ccCalledAway: number;
  ccBestTrade: TradeWithPL | null; ccWorstTrade: TradeWithPL | null;
  dirTotalPL: number; dirWinRate: number; dirCount: number; dirAvgDaysHeld: number; dirTotalReturn: number;
  dirBestTrade: TradeWithPL | null; dirWorstTrade: TradeWithPL | null;
  spreadTotalPL: number; spreadWinRate: number; spreadCount: number; spreadAvgDaysHeld: number; spreadTotalReturn: number;
  spreadBestTrade: TradeWithPL | null; spreadWorstTrade: TradeWithPL | null;
}

interface TradeWithPL {
  ticker: string;
  strike?: number;
  contracts: number;
  pl: number;
  optionType?: string;
  longStrike?: number;
  shortStrike?: number;
}

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
            extra={`Avg return: ${analytics.cspAvgReturn.toFixed(2)}%`}
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
            extra={`Called away: ${analytics.ccCalledAway}`}
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
            extra={`Return: ${analytics.dirTotalReturn >= 0 ? '+' : ''}${analytics.dirTotalReturn.toFixed(1)}%`}
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
            extra={`Return: ${analytics.spreadTotalReturn >= 0 ? '+' : ''}${analytics.spreadTotalReturn.toFixed(1)}%`}
          />
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
        { label: 'Avg Return', value: `${analytics.cspAvgReturn.toFixed(2)}%` },
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
        { label: 'Called Away', value: `${analytics.ccCalledAway}` },
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
        { label: 'Total Return', value: `${analytics.spreadTotalReturn >= 0 ? '+' : ''}${analytics.spreadTotalReturn.toFixed(1)}%` },
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

function StrategyMiniCard({ label, icon, iconBg, iconColor, pl, winRate, count, avgDays, extra }: {
  label: string; icon: string; iconBg: string; iconColor: string;
  pl: number; winRate: number; count: number; avgDays: number; extra?: string;
}) {
  return (
    <div className="bg-card-solid/30 rounded-xl p-5 border border-border/30 space-y-4">
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
      <div className="flex items-center justify-between text-sm text-muted pt-3 border-t border-border/20">
        <span>Avg {avgDays.toFixed(0)}d hold</span>
        {extra && <span>{extra}</span>}
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
