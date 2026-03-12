import { NextRequest, NextResponse } from 'next/server';
import { OptionQuote } from '@/types';

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'POLYGON_API_KEY not configured' },
      { status: 503 }
    );
  }

  const symbols = request.nextUrl.searchParams.get('symbols');
  if (!symbols) {
    return NextResponse.json(
      { error: 'symbols query parameter required' },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.polygon.io/v3/snapshot?ticker.any_of=${encodeURIComponent(symbols)}&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const text = await res.text();
      console.error('Polygon options API error:', res.status, text);
      return NextResponse.json(
        { error: 'Polygon API error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: OptionQuote[] = (data.results || []).map((r: any) => {
      const greeks = r.greeks || {};
      const lastQuote = r.last_quote || {};
      const bid = lastQuote.bid ?? 0;
      const ask = lastQuote.ask ?? 0;
      const lastTradePrice = r.last_trade?.price ?? 0;
      // During off-hours bid/ask are 0; use last trade price, then session close
      const midpoint =
        bid && ask ? (bid + ask) / 2 : lastTradePrice || r.day?.close || r.session?.close || 0;

      const session = r.session || {};
      return {
        symbol: r.ticker ?? '',
        underlying: r.underlying_asset?.ticker ?? '',
        bid,
        ask,
        midpoint,
        lastPrice: lastTradePrice,
        volume: r.day?.volume ?? 0,
        openInterest: r.open_interest ?? 0,
        delta: greeks.delta ?? null,
        gamma: greeks.gamma ?? null,
        theta: greeks.theta ?? null,
        vega: greeks.vega ?? null,
        iv: r.implied_volatility ?? null,
        change: session.change ?? null,
        changePercent: session.change_percent ?? null,
        previousClose: session.previous_close ?? null,
      };
    });

    return NextResponse.json(
      { quotes, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Option quotes fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch option quotes' },
      { status: 502 }
    );
  }
}
