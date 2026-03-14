import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionsChain } from '@/lib/polygon';
import { getHoldingsCollection, getCoveredCallsCollection } from '@/lib/collections';
import { calculateDTE, calculateCCPL } from '@/lib/utils';
import type { OptimizerRow, OptimizerResult, StockPrice } from '@/types';

const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function fetchStockPrice(ticker: string): Promise<StockPrice | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    // Snapshot for real-time price
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(ticker)}&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const t = data.tickers?.[0];
      if (t) {
        const price = t.lastTrade?.p || t.min?.c || t.day?.c || t.prevDay?.c || 0;
        const prevClose = t.prevDay?.c ?? 0;
        return {
          ticker: t.ticker,
          price,
          change: prevClose ? price - prevClose : 0,
          changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    // Fallback: prev close
    const prevUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;
    const prevRes = await fetch(prevUrl, { cache: 'no-store' });
    if (prevRes.ok) {
      const prevData = await prevRes.json();
      const bar = prevData.results?.[0];
      if (bar) {
        return { ticker, price: bar.c ?? 0, change: 0, changePercent: 0, updatedAt: new Date().toISOString() };
      }
    }
  } catch {
    // fall through
  }
  return null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ticker = params.get('ticker');
  const minDTE = parseInt(params.get('minDTE') || '7', 10);
  const maxDTE = parseInt(params.get('maxDTE') || '60', 10);

  if (!ticker) {
    return NextResponse.json({ error: 'ticker query parameter required' }, { status: 400 });
  }

  try {
    // Parallel fetch: holdings, covered calls, stock price, options chain
    const [holdingsCol, ccCol, stockPrice, chain] = await Promise.all([
      getHoldingsCollection(),
      getCoveredCallsCollection(),
      fetchStockPrice(ticker),
      fetchOptionsChain(ticker, 'call', minDTE, maxDTE),
    ]);

    // Get holdings for this ticker
    const holdings = await holdingsCol.find({ ticker: { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') } }).toArray();
    if (holdings.length === 0) {
      return NextResponse.json({ error: `No holdings found for ${ticker}` }, { status: 404 });
    }

    const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
    const totalCost = holdings.reduce((s, h) => s + h.shares * h.costBasisPerShare, 0);
    const costBasisPerShare = totalCost / totalShares;

    // Get open covered calls for coverage count
    const openCCs = await ccCol.find({
      ticker: { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') },
      status: 'open',
    }).toArray();
    const coveredShares = openCCs.reduce((s, c) => s + c.sharesHeld, 0);
    const coveredContracts = Math.floor(coveredShares / 100);
    const availableContracts = Math.max(0, Math.floor(totalShares / 100) - coveredContracts);

    // Compute historical CC premium on this ticker
    const closedCCs = await ccCol.find({
      ticker: { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') },
      status: { $ne: 'open' },
    }).toArray();
    const historicalCCPremium = closedCCs.reduce((s, c) => s + calculateCCPL(c), 0);

    if (!stockPrice) {
      return NextResponse.json({ error: `Could not fetch stock price for ${ticker}` }, { status: 502 });
    }

    const currentPrice = stockPrice.price;

    // Compute optimizer rows from chain (include contracts without pricing so user can see available strikes)
    const rows: OptimizerRow[] = chain
      .map(c => {
        const dte = calculateDTE(c.expiration);
        const premiumPerShare = c.midpoint;
        const totalPremium = premiumPerShare * 100 * availableContracts;
        const annualizedReturn = dte > 0 ? (premiumPerShare / currentPrice) * (365 / dte) * 100 : 0;
        const returnOnCostBasis = dte > 0 ? (premiumPerShare / costBasisPerShare) * (365 / dte) * 100 : 0;
        const distanceFromPrice = ((c.strike - currentPrice) / currentPrice) * 100;
        const distanceFromCostBasis = ((c.strike - costBasisPerShare) / costBasisPerShare) * 100;
        const breakevenPerShare = costBasisPerShare - premiumPerShare - (historicalCCPremium / totalShares);
        const calledAwayPL = (c.strike - costBasisPerShare + premiumPerShare) * totalShares;
        const gap = costBasisPerShare - currentPrice;
        const weeksToBreakeven = premiumPerShare > 0 ? gap / premiumPerShare : Infinity;
        const bidAskSpread = c.midpoint > 0 ? ((c.ask - c.bid) / c.midpoint) * 100 : 0;

        return {
          symbol: c.symbol,
          strike: c.strike,
          expiration: c.expiration,
          dte,
          bid: c.bid,
          ask: c.ask,
          midpoint: c.midpoint,
          delta: c.delta,
          theta: c.theta,
          iv: c.iv,
          openInterest: c.openInterest,
          volume: c.volume,
          premiumPerShare,
          totalPremium,
          annualizedReturn,
          returnOnCostBasis,
          distanceFromPrice,
          distanceFromCostBasis,
          breakevenPerShare,
          calledAwayPL,
          weeksToBreakeven: Math.max(0, weeksToBreakeven),
          bidAskSpread,
        };
      })
      .sort((a, b) => {
        // Sort by expiration then strike
        const expCmp = a.expiration.localeCompare(b.expiration);
        return expCmp !== 0 ? expCmp : a.strike - b.strike;
      });

    const result: OptimizerResult = {
      ticker: ticker.toUpperCase(),
      stockPrice: currentPrice,
      costBasisPerShare,
      totalShares,
      availableContracts,
      coveredContracts,
      historicalCCPremium,
      chain: rows,
    };

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('CC Optimizer error:', err);
    return NextResponse.json({ error: 'Failed to compute optimizer data' }, { status: 500 });
  }
}
