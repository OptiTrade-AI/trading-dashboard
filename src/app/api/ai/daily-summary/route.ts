import { NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import { getDailySummaryCollection } from '@/lib/collections';

export const dynamic = 'force-dynamic';

const CACHE_HOURS = 24;

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: null, available: false });
  }

  // Check cache
  const col = await getDailySummaryCollection();
  const cached = await col.find({}).sort({ generatedAt: -1 }).limit(1).toArray();

  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].generatedAt).getTime();
    if (age < CACHE_HOURS * 60 * 60 * 1000) {
      return NextResponse.json({ summary: cached[0].summary, available: true });
    }
  }

  // Generate new summary
  const data = await gatherPortfolioData();

  if (data.openPositions.length === 0 && (data.closedStats as { totalTrades: number }).totalTrades === 0) {
    return NextResponse.json({ summary: null, available: true });
  }

  const openCount = data.openPositions.length;
  const heat = data.accountValue > 0 ? (data.totalCapitalAtRisk / data.accountValue * 100).toFixed(1) : '0';
  const closedStats = data.closedStats as { totalPL: number; totalTrades: number };

  const positions = data.openPositions.map(p => {
    const dte = p.dte as number;
    return `${p.strategy} ${p.ticker} ${p.label} DTE:${dte}`;
  }).join('; ');

  const systemPrompt = `Generate a 1-2 sentence daily portfolio summary. Be specific with numbers. Mention the most notable thing — an expiring position, high heat, a winning streak, or a risk.

Portfolio: $${data.accountValue.toLocaleString()} account, ${openCount} open positions, ${heat}% heat.
Realized P/L: $${closedStats.totalPL.toFixed(0)} across ${closedStats.totalTrades} trades.
Positions: ${positions || 'none'}

Return ONLY the 1-2 sentence summary text, no JSON, no markdown.`;

  const result = await aiCall({
    feature: 'daily-summary',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate my daily summary.' }],
    maxTokens: 150,
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
