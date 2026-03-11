import { NextRequest, NextResponse } from 'next/server';
import { StockPrice } from '@/types';

// Fetch prices via the snapshot endpoint (real-time, works best during market hours)
async function fetchSnapshot(
  tickersCsv: string,
  apiKey: string,
): Promise<StockPrice[]> {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickersCsv)}&apiKey=${apiKey}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.tickers || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => {
      const price = t.lastTrade?.p || t.min?.c || t.day?.c || t.prevDay?.c || 0;
      const prevClose = t.prevDay?.c ?? 0;
      const change = prevClose ? price - prevClose : 0;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;

      return {
        ticker: t.ticker,
        price,
        change,
        changePercent,
        updatedAt: new Date().toISOString(),
      } as StockPrice;
    },
  );
}

// Fallback: fetch previous close per-ticker (works on all plans, always returns data)
async function fetchPrevClose(
  tickerList: string[],
  apiKey: string,
): Promise<StockPrice[]> {
  const results = await Promise.all(
    tickerList.map(async (ticker) => {
      try {
        const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        const bar = data.results?.[0];
        if (!bar) return null;
        return {
          ticker,
          price: bar.c ?? 0,
          change: 0,
          changePercent: 0,
          updatedAt: new Date().toISOString(),
        } as StockPrice;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is StockPrice => r !== null);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'POLYGON_API_KEY not configured' },
      { status: 503 }
    );
  }

  const tickers = request.nextUrl.searchParams.get('tickers');
  if (!tickers) {
    return NextResponse.json(
      { error: 'tickers query parameter required' },
      { status: 400 }
    );
  }

  try {
    const tickerList = tickers.split(',').map((t) => t.trim()).filter(Boolean);

    // Try snapshot first (real-time data)
    let prices = await fetchSnapshot(tickers, apiKey);

    // If snapshot returned nothing (off-hours / plan limitation), fall back to prev close
    if (prices.length === 0 && tickerList.length > 0) {
      prices = await fetchPrevClose(tickerList, apiKey);
    }

    // If snapshot returned partial data, fill in missing tickers from prev close
    if (prices.length > 0 && prices.length < tickerList.length) {
      const have = new Set(prices.map((p) => p.ticker));
      const missing = tickerList.filter((t) => !have.has(t));
      if (missing.length > 0) {
        const fallback = await fetchPrevClose(missing, apiKey);
        prices = [...prices, ...fallback];
      }
    }

    return NextResponse.json(
      { prices, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Stock price fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stock prices' },
      { status: 502 }
    );
  }
}
