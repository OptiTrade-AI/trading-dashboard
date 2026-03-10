import { NextRequest, NextResponse } from 'next/server';
import { AggBar } from '@/types';

// In-memory cache with 5-min TTL
const cache = new Map<string, { data: AggBar[]; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(ticker: string, timespan: string, multiplier: string, from: string, to: string) {
  return `${ticker}:${timespan}:${multiplier}:${from}:${to}`;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'POLYGON_API_KEY not configured' },
      { status: 503 }
    );
  }

  const params = request.nextUrl.searchParams;
  const tickers = params.get('tickers');
  const timespan = params.get('timespan') || 'day';
  const multiplier = params.get('multiplier') || '1';
  const from = params.get('from');
  const to = params.get('to');

  if (!tickers || !from || !to) {
    return NextResponse.json(
      { error: 'tickers, from, and to query parameters required' },
      { status: 400 }
    );
  }

  const tickerList = tickers.split(',').slice(0, 20);

  try {
    const now = Date.now();
    const results = await Promise.allSettled(
      tickerList.map(async (ticker) => {
        const key = getCacheKey(ticker, timespan, multiplier, from, to);
        const cached = cache.get(key);
        if (cached && cached.expiry > now) {
          return { ticker, bars: cached.data };
        }

        const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
          const text = await res.text();
          console.error(`Polygon aggs error for ${ticker}:`, res.status, text);
          throw new Error(`Polygon API error for ${ticker}`);
        }

        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bars: AggBar[] = (data.results || []).map((r: any) => ({
          t: r.t,
          o: r.o,
          h: r.h,
          l: r.l,
          c: r.c,
          v: r.v,
        }));

        cache.set(key, { data: bars, expiry: now + CACHE_TTL });
        return { ticker, bars };
      })
    );

    const aggregates: Record<string, AggBar[]> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        aggregates[result.value.ticker] = result.value.bars;
      }
    }

    return NextResponse.json(
      { aggregates },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Stock aggregates fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stock aggregates' },
      { status: 502 }
    );
  }
}
