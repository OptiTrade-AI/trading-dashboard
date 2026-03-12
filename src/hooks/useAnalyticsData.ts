import { useMemo } from 'react';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, StockEvent } from '@/types';
import {
  calculatePL,
  calculatePLPercent,
  calculateDaysHeld,
  calculateCCPL,
  calculateCCPLPercent,
  calculateDirectionalPL,
  calculateDirectionalPLPercent,
  calculateSpreadPL,
  calculateSpreadPLPercent,
} from '@/lib/utils';
import { format, parse, parseISO, startOfMonth, isThisMonth, isThisYear, subMonths, subDays, startOfYear, isAfter } from 'date-fns';

export type TimeRange = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

export interface TradeWithPL {
  ticker: string;
  type: 'csp' | 'cc' | 'directional' | 'spread';
  pl: number;
  plPercent: number;
  daysHeld: number;
  exitDate?: string;
  contracts?: number;
  strike?: number;
  premiumCollected?: number;
  entryDate?: string;
  expiration?: string;
  optionType?: string;
  longStrike?: number;
  shortStrike?: number;
}

export interface AnalyticsData {
  totalPL: number;
  thisMonthPL: number;
  thisYearPL: number;
  totalTrades: number;
  avgPLPerTrade: number;
  totalPremiumCollected: number;
  returnOnAccount: number;
  cumulativeWithDrawdown: { date: string; total: number; drawdown: number; trade: string }[];
  cspTotalPL: number;
  cspWinRate: number;
  cspAvgReturn: number;
  cspAvgDaysHeld: number;
  cspBestTrade: TradeWithPL | null;
  cspWorstTrade: TradeWithPL | null;
  cspCount: number;
  ccTotalPL: number;
  ccWinRate: number;
  ccCalledAway: number;
  ccAvgDaysHeld: number;
  ccBestTrade: TradeWithPL | null;
  ccWorstTrade: TradeWithPL | null;
  ccCount: number;
  dirTotalPL: number;
  dirWinRate: number;
  dirTotalReturn: number;
  dirTotalCost: number;
  dirAvgDaysHeld: number;
  dirBestTrade: TradeWithPL | null;
  dirWorstTrade: TradeWithPL | null;
  dirCount: number;
  spreadTotalPL: number;
  spreadWinRate: number;
  spreadTotalReturn: number;
  spreadCapitalAtRisk: number;
  spreadAvgDaysHeld: number;
  spreadBestTrade: TradeWithPL | null;
  spreadWorstTrade: TradeWithPL | null;
  spreadCount: number;
  plByTicker: { ticker: string; pl: number }[];
  monthlyStacked: { month: string; csp: number; cc: number; directional: number; spreads: number }[];
  tradeFrequency: { month: string; count: number }[];
  strategyPL: { name: string; value: number; color: string }[];
  heatmapTrades: { exitDate: string; pl: number }[];
  overallWinRate: number;
  plDistribution: { range: string; count: number; isProfit: boolean }[];
  scatterData: { daysHeld: number; pl: number; ticker: string; type: string }[];
  streakData: { currentStreak: number; currentStreakType: 'win' | 'loss' | 'none'; longestWinStreak: number; longestLossStreak: number };
  rollingPLData: { date: string; total: number }[];
  rolling30DayPL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  biggestWin: number;
  worstTrade: number;
  holdTimeStrategies: { label: string; color: string; min: number; avg: number; max: number; count: number }[];
  holdTimeBuckets: { label: string; range: string; trades: number; winRate: number; avgPL: number }[];
}

export function useAnalyticsData(
  closedTrades: Trade[],
  closedCalls: CoveredCall[],
  closedDirectional: DirectionalTrade[],
  closedSpreads: SpreadTrade[],
  stockEvents: StockEvent[],
  includeStockPL: boolean,
  timeRange: TimeRange,
  accountValue: number,
): AnalyticsData | null {
  return useMemo(() => {
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
    const allTrades: TradeWithPL[] = [...cspWithPL, ...ccWithPL, ...dirWithPL, ...spreadWithPL];
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
    const returnOnAccount = accountValue > 0
      ? ((cspTotalPL + ccTotalPL + dirTotalPL + spreadTotalPL + filteredStockPL) / accountValue) * 100
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
    const worstTradePL = allTrades.length > 0 ? Math.min(...allTrades.map((t) => t.pl)) : 0;

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
      const bucketWins = bucket.filter((t) => t.pl > 0).length;
      return {
        label: def.label,
        range: def.range,
        trades: bucket.length,
        winRate: bucket.length > 0 ? (bucketWins / bucket.length) * 100 : 0,
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
      worstTrade: worstTradePL,
      holdTimeStrategies,
      holdTimeBuckets,
    };
  }, [closedTrades, closedCalls, closedDirectional, closedSpreads, stockEvents, includeStockPL, timeRange, accountValue]);
}
