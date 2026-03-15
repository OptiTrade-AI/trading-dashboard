import { NextRequest, NextResponse } from 'next/server';

// In-memory cache with 1-hour TTL
const earningsCache = new Map<string, { date: string | null; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchNextEarningsDate(ticker: string, apiKey: string): Promise<string | null> {
  const cached = earningsCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.date;
  }

  try {
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&order=desc&limit=1&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      earningsCache.set(ticker, { date: null, timestamp: Date.now() });
      return null;
    }

    const body = await res.json();
    const results = body.results;
    if (!results || results.length === 0) {
      earningsCache.set(ticker, { date: null, timestamp: Date.now() });
      return null;
    }

    const lastFiling = results[0];
    const filingDate = lastFiling.filing_date || lastFiling.end_date;
    if (!filingDate) {
      earningsCache.set(ticker, { date: null, timestamp: Date.now() });
      return null;
    }

    // Estimate next earnings: add ~90 days (one quarter) to last filing date
    const lastDate = new Date(filingDate);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 90);

    // If estimated next date is in the past, keep adding quarters until future
    const now = new Date();
    while (nextDate < now) {
      nextDate.setDate(nextDate.getDate() + 90);
    }

    const isoDate = nextDate.toISOString().slice(0, 10);
    earningsCache.set(ticker, { date: isoDate, timestamp: Date.now() });
    return isoDate;
  } catch {
    earningsCache.set(ticker, { date: null, timestamp: Date.now() });
    return null;
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'POLYGON_API_KEY not configured' }, { status: 500 });
  }

  const tickersParam = request.nextUrl.searchParams.get('tickers');
  if (!tickersParam) {
    return NextResponse.json({});
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(t => /^[A-Z]{1,10}$/i.test(t)).slice(0, 50);
  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  // Fetch all in parallel (with concurrency limit)
  const results: Record<string, string | null> = {};
  const batchSize = 5;

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      const date = await fetchNextEarningsDate(ticker, apiKey);
      results[ticker] = date;
    });
    await Promise.all(promises);
  }

  return NextResponse.json(results);
}
