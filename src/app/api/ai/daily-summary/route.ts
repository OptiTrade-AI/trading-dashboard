import { NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import { getDailySummaryCollection } from '@/lib/collections';

export const dynamic = 'force-dynamic';

const CACHE_HOURS = 24;

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: null, available: false });
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  // Check cache (skip if force refresh)
  const col = await getDailySummaryCollection();

  if (!forceRefresh) {
    const cached = await col.find({}).sort({ generatedAt: -1 }).limit(1).toArray();

    if (cached.length > 0) {
      const age = Date.now() - new Date(cached[0].generatedAt).getTime();
      if (age < CACHE_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({ summary: cached[0].summary, available: true });
      }
    }
  }

  // Generate new summary
  const data = await gatherPortfolioData();

  if (data.openPositions.length === 0 && (data.closedStats as { totalTrades: number }).totalTrades === 0) {
    return NextResponse.json({ summary: null, available: true });
  }

  const openCount = data.openPositions.length;
  const heat = data.accountValue > 0 ? (data.totalCapitalAtRisk / data.accountValue * 100).toFixed(1) : '0';
  const closedStats = data.closedStats as {
    totalPL: number; totalTrades: number;
    csp: { winRate: number; totalPL: number; totalTrades: number };
    cc: { winRate: number; totalPL: number; totalTrades: number };
    directional: { winRate: number; totalPL: number; totalTrades: number };
    spreads: { winRate: number; totalPL: number; totalTrades: number };
  };

  const positions = data.openPositions.map(p => {
    const dte = p.dte as number;
    return `${p.strategy} ${p.ticker} ${p.label} DTE:${dte} risk:$${Number(p.capitalAtRisk || 0).toLocaleString()}`;
  }).join('; ');

  // Expiring soon (0-2 DTE) — use actual expiration dates for accuracy
  const expiringSoon = data.openPositions.filter(p => (p.dte as number) <= 2);
  const expiringLine = expiringSoon.length > 0
    ? `EXPIRING SOON: ${expiringSoon.map(p => `${p.ticker} ${p.label} expires ${p.expiration} (${p.dte === 0 ? 'TODAY' : p.dte === 1 ? 'TOMORROW' : `in ${p.dte} days`})`).join(', ')}`
    : 'No positions expiring within 2 days.';

  // Strategy breakdown
  const strategyLines: string[] = [];
  if (closedStats.csp?.totalTrades > 0) strategyLines.push(`CSPs: ${closedStats.csp.totalTrades} trades, ${closedStats.csp.winRate.toFixed(0)}% win rate, $${closedStats.csp.totalPL.toFixed(0)} P/L`);
  if (closedStats.cc?.totalTrades > 0) strategyLines.push(`CCs: ${closedStats.cc.totalTrades} trades, ${closedStats.cc.winRate.toFixed(0)}% win rate, $${closedStats.cc.totalPL.toFixed(0)} P/L`);
  if (closedStats.directional?.totalTrades > 0) strategyLines.push(`Directional: ${closedStats.directional.totalTrades} trades, ${closedStats.directional.winRate.toFixed(0)}% win rate, $${closedStats.directional.totalPL.toFixed(0)} P/L`);
  if (closedStats.spreads?.totalTrades > 0) strategyLines.push(`Spreads: ${closedStats.spreads.totalTrades} trades, ${closedStats.spreads.winRate.toFixed(0)}% win rate, $${closedStats.spreads.totalPL.toFixed(0)} P/L`);

  // Holdings summary
  const holdingsLine = data.holdings.length > 0
    ? `Stock holdings: ${data.holdings.map(h => `${h.ticker} ${h.shares}sh @$${h.costBasisPerShare.toFixed(2)}`).join(', ')}`
    : '';

  // Ticker concentration warnings
  const concentrated = Object.entries(data.tickerConcentration).filter(([, count]) => count >= 3);
  const concentrationLine = concentrated.length > 0
    ? `Concentration risk: ${concentrated.map(([ticker, count]) => `${ticker} (${count} positions)`).join(', ')}`
    : '';

  // Recent stock events
  const recentEvents = data.stockEvents.slice(0, 3);
  const eventsLine = recentEvents.length > 0
    ? `Recent stock events: ${recentEvents.map(e => `${e.ticker} ${e.shares}sh $${e.realizedPL.toFixed(0)} P/L${e.isTaxLossHarvest ? ' (TLH)' : ''}`).join(', ')}`
    : '';

  const today = new Date().toISOString().split('T')[0];
  const systemPrompt = `Generate a concise 2-3 sentence daily portfolio brief. Be specific with numbers. Prioritize the single most actionable insight — expiring positions, high heat, concentration risk, or a notable streak. Do NOT repeat all the data back — pick the 1-2 most important things the trader needs to know right now. Use the actual expiration dates to determine when positions expire (today is ${today}) — say "expires tomorrow" or "expires Friday", never generalize as "today/tomorrow" if they all expire the same day.

Portfolio: $${data.accountValue.toLocaleString()} account, ${openCount} open positions, ${heat}% heat (max allowed: ${data.maxHeatPercent}%).
Realized P/L: $${closedStats.totalPL.toFixed(0)} across ${closedStats.totalTrades} trades.
${expiringLine}
Positions: ${positions || 'none'}
${strategyLines.length > 0 ? 'Strategy breakdown: ' + strategyLines.join('; ') : ''}
${holdingsLine}
${concentrationLine}
${eventsLine}

Return ONLY the 2-3 sentence summary text, no JSON, no markdown.`;

  const result = await aiCall({
    feature: 'daily-summary',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate my daily summary.' }],
    maxTokens: 512,
  });

  if (!result) {
    return NextResponse.json({ summary: null, available: false });
  }

  const summary = result.text.trim();

  // Cache in MongoDB
  await col.deleteMany({});
  await col.insertOne({
    id: crypto.randomUUID(),
    summary,
    generatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ summary, available: true });
}
