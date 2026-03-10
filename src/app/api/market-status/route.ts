import { NextResponse } from 'next/server';
import { MarketStatus } from '@/types';

export async function GET() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'POLYGON_API_KEY not configured' },
      { status: 503 }
    );
  }

  try {
    const url = `https://api.polygon.io/v1/marketstatus/now?apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const text = await res.text();
      console.error('Polygon market status error:', res.status, text);
      return NextResponse.json(
        { error: 'Polygon API error' },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Polygon returns market field as "open", "closed", "extended-hours", etc.
    const marketValue = data.market ?? 'closed';
    let market: MarketStatus['market'];
    if (marketValue === 'open') {
      market = 'open';
    } else if (marketValue === 'extended-hours' || marketValue === 'pre-market' || marketValue === 'after-hours') {
      market = 'extended-hours';
    } else {
      market = 'closed';
    }

    const status: MarketStatus = {
      market,
      serverTime: data.serverTime ?? new Date().toISOString(),
    };

    return NextResponse.json({ status });
  } catch (err) {
    console.error('Market status fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch market status' },
      { status: 502 }
    );
  }
}
