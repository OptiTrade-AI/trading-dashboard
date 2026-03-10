import { NextRequest, NextResponse } from 'next/server';
import { TickerInfo } from '@/types';

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
    const url = `https://api.polygon.io/v3/reference/tickers?ticker.any_of=${encodeURIComponent(tickers)}&active=true&limit=100&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const text = await res.text();
      console.error('Polygon ticker details error:', res.status, text);
      return NextResponse.json(
        { error: 'Polygon API error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickerInfos: TickerInfo[] = (data.results || []).map((r: any) => ({
      ticker: r.ticker,
      name: r.name ?? r.ticker,
    }));

    return NextResponse.json(
      { tickers: tickerInfos },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  } catch (err) {
    console.error('Ticker details fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch ticker details' },
      { status: 502 }
    );
  }
}
