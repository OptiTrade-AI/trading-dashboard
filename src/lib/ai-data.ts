import {
  getCspTradesCollection,
  getCoveredCallsCollection,
  getDirectionalTradesCollection,
  getSpreadsCollection,
  getAccountSettingsCollection,
  getStockEventsCollection,
  getHoldingsCollection,
} from './collections';
import { calculatePL, calculateDirectionalPL, calculateSpreadPL, calculateDTE } from './utils';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade } from '@/types';
import { differenceInDays, parseISO, subMonths } from 'date-fns';

function calculateCCPL(call: CoveredCall): number {
  if (call.status === 'open') return 0;
  return call.premiumCollected - (call.exitPrice ?? 0);
}

interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgDaysHeld: number;
  avgDTEAtEntry: number;
  exitReasons: Record<string, number>;
  topTickers: { ticker: string; count: number; pl: number }[];
}

function computeClosedStats<T extends { ticker: string; dteAtEntry: number; entryDate: string; exitDate?: string }>(
  trades: T[],
  plFn: (t: T) => number,
  exitReasonFn: (t: T) => string | undefined,
): TradeStats {
  if (trades.length === 0) {
    return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPL: 0, avgPL: 0, avgDaysHeld: 0, avgDTEAtEntry: 0, exitReasons: {}, topTickers: [] };
  }
  const pls = trades.map(t => ({ ticker: t.ticker, pl: plFn(t) }));
  const wins = pls.filter(p => p.pl > 0).length;
  const totalPL = pls.reduce((s, p) => s + p.pl, 0);
  const exitReasons: Record<string, number> = {};
  for (const t of trades) {
    const reason = exitReasonFn(t) || 'unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  }
  const tickerMap = new Map<string, { count: number; pl: number }>();
  for (const p of pls) {
    const e = tickerMap.get(p.ticker) || { count: 0, pl: 0 };
    e.count++; e.pl += p.pl;
    tickerMap.set(p.ticker, e);
  }
  const topTickers = Array.from(tickerMap.entries()).map(([ticker, s]) => ({ ticker, ...s })).sort((a, b) => b.count - a.count).slice(0, 10);
  const daysHeld = trades.map(t => {
    const entry = parseISO(t.entryDate);
    const exit = t.exitDate ? parseISO(t.exitDate) : new Date();
    return Math.max(1, differenceInDays(exit, entry));
  });
  return {
    totalTrades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: (wins / trades.length) * 100,
    totalPL,
    avgPL: totalPL / trades.length,
    avgDaysHeld: daysHeld.reduce((s, d) => s + d, 0) / daysHeld.length,
    avgDTEAtEntry: trades.reduce((s, t) => s + t.dteAtEntry, 0) / trades.length,
    exitReasons,
    topTickers,
  };
}

export interface PortfolioData {
  allCSPs: Trade[];
  allCCs: CoveredCall[];
  allDir: DirectionalTrade[];
  allSpreads: SpreadTrade[];
  accountValue: number;
  maxHeatPercent: number;
  openPositions: Record<string, unknown>[];
  closedStats: Record<string, unknown>;
  holdings: { ticker: string; shares: number; costBasisPerShare: number }[];
  stockEvents: { ticker: string; shares: number; realizedPL: number; saleDate: string; isTaxLossHarvest: boolean }[];
  totalCapitalAtRisk: number;
  tickerConcentration: Record<string, number>;
}

/**
 * Gather complete portfolio data from MongoDB for AI features.
 * This is the single source of truth for server-side portfolio context.
 */
export async function gatherPortfolioData(lookbackMonths: number = 6): Promise<PortfolioData> {
  const cutoff = subMonths(new Date(), lookbackMonths);

  const [cspCol, ccCol, dirCol, spCol, settingsCol, eventsCol, holdingsCol] = await Promise.all([
    getCspTradesCollection(), getCoveredCallsCollection(), getDirectionalTradesCollection(),
    getSpreadsCollection(), getAccountSettingsCollection(), getStockEventsCollection(), getHoldingsCollection(),
  ]);

  const [allCSPs, allCCs, allDir, allSpreads, settings, events, holdings] = await Promise.all([
    cspCol.find({}).toArray(), ccCol.find({}).toArray(), dirCol.find({}).toArray(),
    spCol.find({}).toArray(), settingsCol.findOne({}), eventsCol.find({}).toArray(), holdingsCol.find({}).toArray(),
  ]);

  const accountValue = settings?.accountValue || 0;
  const maxHeatPercent = settings?.maxHeatPercent || 30;

  // Compute closed trade stats
  const closedCSPs = allCSPs.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);
  const closedCCs = allCCs.filter(t => t.status !== 'open' && t.exitDate && parseISO(t.exitDate) >= cutoff);
  const closedDir = allDir.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);
  const closedSpreads = allSpreads.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);

  const closedStats = {
    csp: computeClosedStats(closedCSPs, calculatePL, t => t.exitReason),
    cc: computeClosedStats(closedCCs, calculateCCPL, t => t.exitReason),
    directional: computeClosedStats(closedDir, calculateDirectionalPL, t => t.exitReason),
    spreads: computeClosedStats(closedSpreads, calculateSpreadPL, t => t.exitReason),
    totalPL: closedCSPs.reduce((s, t) => s + calculatePL(t), 0) +
      closedCCs.reduce((s, t) => s + calculateCCPL(t), 0) +
      closedDir.reduce((s, t) => s + calculateDirectionalPL(t), 0) +
      closedSpreads.reduce((s, t) => s + calculateSpreadPL(t), 0),
    totalTrades: closedCSPs.length + closedCCs.length + closedDir.length + closedSpreads.length,
  };

  // Build open positions
  const openPositions: Record<string, unknown>[] = [];
  for (const t of allCSPs.filter(t => t.status === 'open')) {
    openPositions.push({
      id: t.id, ticker: t.ticker, strategy: 'CSP', label: `$${t.strike}P`, contracts: t.contracts,
      dte: calculateDTE(t.expiration), expiration: t.expiration, entryDate: t.entryDate,
      capitalAtRisk: t.collateral, premiumCollected: t.premiumCollected, strike: t.strike,
    });
  }
  for (const c of allCCs.filter(c => c.status === 'open')) {
    openPositions.push({
      id: c.id, ticker: c.ticker, strategy: 'CC', label: `$${c.strike}C`, contracts: c.contracts,
      dte: calculateDTE(c.expiration), expiration: c.expiration, entryDate: c.entryDate,
      capitalAtRisk: c.costBasis, premiumCollected: c.premiumCollected, strike: c.strike,
    });
  }
  for (const t of allDir.filter(t => t.status === 'open')) {
    openPositions.push({
      id: t.id, ticker: t.ticker, strategy: 'Directional', label: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'}`,
      contracts: t.contracts, dte: calculateDTE(t.expiration), expiration: t.expiration, entryDate: t.entryDate,
      capitalAtRisk: t.costAtOpen, entryPrice: t.entryPrice, strike: t.strike, optionType: t.optionType,
    });
  }
  for (const s of allSpreads.filter(s => s.status === 'open')) {
    openPositions.push({
      id: s.id, ticker: s.ticker, strategy: 'Spread', label: `${s.longStrike}/${s.shortStrike}`,
      contracts: s.contracts, dte: calculateDTE(s.expiration), expiration: s.expiration, entryDate: s.entryDate,
      capitalAtRisk: s.maxLoss, spreadType: s.spreadType, longStrike: s.longStrike, shortStrike: s.shortStrike,
      netDebit: s.netDebit, maxProfit: s.maxProfit, maxLoss: s.maxLoss,
    });
  }

  const totalCapitalAtRisk = openPositions.reduce((s, p) => s + Number(p.capitalAtRisk || 0), 0);

  // Ticker concentration
  const tickerConcentration: Record<string, number> = {};
  for (const p of openPositions) {
    const t = p.ticker as string;
    tickerConcentration[t] = (tickerConcentration[t] || 0) + 1;
  }

  return {
    allCSPs, allCCs, allDir, allSpreads,
    accountValue, maxHeatPercent,
    openPositions, closedStats,
    holdings: holdings.map(h => ({ ticker: h.ticker, shares: h.shares, costBasisPerShare: h.costBasisPerShare })),
    stockEvents: events.slice(0, 10).map(e => ({
      ticker: e.ticker, shares: e.shares, realizedPL: e.realizedPL, saleDate: e.saleDate, isTaxLossHarvest: e.isTaxLossHarvest,
    })),
    totalCapitalAtRisk,
    tickerConcentration,
  };
}

/**
 * Get closed trades for a specific ticker across all strategies.
 */
export function getClosedTradesForTicker(data: PortfolioData, ticker: string) {
  const csps = data.allCSPs.filter(t => t.ticker === ticker && t.status === 'closed');
  const ccs = data.allCCs.filter(t => t.ticker === ticker && t.status !== 'open');
  const dirs = data.allDir.filter(t => t.ticker === ticker && t.status === 'closed');
  const spreads = data.allSpreads.filter(t => t.ticker === ticker && t.status === 'closed');

  const trades: { strategy: string; pl: number; daysHeld: number; exitReason: string; date: string }[] = [];
  for (const t of csps) {
    trades.push({ strategy: 'CSP', pl: calculatePL(t), daysHeld: differenceInDays(parseISO(t.exitDate || t.entryDate), parseISO(t.entryDate)), exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate });
  }
  for (const t of ccs) {
    trades.push({ strategy: 'CC', pl: calculateCCPL(t), daysHeld: differenceInDays(parseISO(t.exitDate || t.entryDate), parseISO(t.entryDate)), exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate });
  }
  for (const t of dirs) {
    trades.push({ strategy: 'Directional', pl: calculateDirectionalPL(t), daysHeld: differenceInDays(parseISO(t.exitDate || t.entryDate), parseISO(t.entryDate)), exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate });
  }
  for (const t of spreads) {
    trades.push({ strategy: 'Spread', pl: calculateSpreadPL(t), daysHeld: differenceInDays(parseISO(t.exitDate || t.entryDate), parseISO(t.entryDate)), exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate });
  }
  return trades.sort((a, b) => b.date.localeCompare(a.date));
}
