import { NextRequest, NextResponse } from 'next/server';
import { StockPrice } from '@/types';

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
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickers)}&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const text = await res.text();
      console.error('Polygon API error:', res.status, text);
      return NextResponse.json(
        { error: 'Polygon API error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const prices: StockPrice[] = (data.tickers || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => {
        const price =
          t.lastTrade?.p ?? t.day?.c ?? t.prevDay?.c ?? 0;
        const prevClose = t.prevDay?.c ?? 0;
        const change = prevClose ? price - prevClose : 0;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;

        return {
          ticker: t.ticker,
          price,
          change,
          changePercent,
          updatedAt: new Date().toISOString(),
        };
      }
    );

    return NextResponse.json(
      { prices },
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
