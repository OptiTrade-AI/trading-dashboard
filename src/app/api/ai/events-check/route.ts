import { NextResponse } from 'next/server';
import { aiCall, extractJSON } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ events: [], available: false });
  }

  const data = await gatherPortfolioData();

  if (data.openPositions.length === 0) {
    return NextResponse.json({ events: [], available: true });
  }

  // Get unique tickers from open positions
  const tickers = [...new Set(data.openPositions.map(p => p.ticker as string))];

  // Try to fetch earnings data from Polygon if available
  let earningsInfo = '';
  const polygonKey = process.env.POLYGON_API_KEY;
  if (polygonKey) {
    try {
      // Fetch upcoming events for tickers with open positions
      const now = new Date().toISOString().slice(0, 10);
      const twoMonths = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const ticker of tickers.slice(0, 10)) {
        try {
          const res = await fetch(
            `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&filing_date.gte=${now}&filing_date.lte=${twoMonths}&limit=1&apiKey=${polygonKey}`,
            { next: { revalidate: 3600 } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.results?.length > 0) {
              earningsInfo += `\n${ticker}: upcoming filing around ${data.results[0].filing_date || 'soon'}`;
            }
          }
        } catch {
          // Skip individual ticker failures
        }
      }
    } catch {
      // Polygon API not available, fall back to AI estimation
    }
  }

  const now = new Date().toISOString().slice(0, 10);

  let positionsSummary = '';
  for (const p of data.openPositions) {
    positionsSummary += `\n${p.strategy} ${p.ticker} ${p.label} | ${p.contracts} contracts | DTE ${p.dte} | Exp ${p.expiration}`;
  }

  const systemPrompt = `You are a corporate events watchdog for options traders. Given open positions, identify tickers that likely have upcoming earnings or major events that could impact positions.

Today: ${now}
Tickers with open positions: ${tickers.join(', ')}

Open positions:${positionsSummary}
${earningsInfo ? `\nKnown upcoming events:${earningsInfo}` : ''}

Based on typical quarterly earnings schedules, identify which tickers likely have earnings reports within the expiration window of their positions. Major tech companies report in Jan/Apr/Jul/Oct. Banks report early in those months. Retail reports in Feb/May/Aug/Nov.

Return ONLY a JSON array (no markdown):
[
  {
    "ticker": "<TICKER>",
    "eventType": "earnings" | "ex-dividend" | "FDA" | "other",
    "eventDate": "<estimated YYYY-MM-DD or 'unknown'>",
    "daysUntil": <estimated days>,
    "urgency": "low" | "medium" | "high",
    "recommendation": "<one sentence action recommendation>",
    "positions": ["<position description>"]
  }
]

Urgency:
- high: Event likely BEFORE position expiration AND position has significant risk
- medium: Event might be before expiration
- low: Event likely after expiration

If no events are detected, return [].
Only include events you have reasonable confidence about.`;

  const result = await aiCall({
    feature: 'events-check',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: `Check for upcoming events on my open positions: ${tickers.join(', ')}` }],
    maxTokens: 1024,
  });

  if (!result) {
    return NextResponse.json({ events: [], available: false });
  }

  try {
    const events = extractJSON(result.text);
    return NextResponse.json({ events, available: true });
  } catch {
    return NextResponse.json({ events: [], available: false });
  }
}
