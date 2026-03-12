import { NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import { getPatternAnalysesCollection } from '@/lib/collections';
import { calculatePL, calculateCCPL, calculateDirectionalPL, calculateSpreadPL, calculateDaysHeld } from '@/lib/utils';

export async function GET() {
  const col = await getPatternAnalysesCollection();
  const history = await col.find({}).sort({ timestamp: -1 }).limit(20).toArray();
  return NextResponse.json({ history });
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const data = await gatherPortfolioData(12); // 12 months of history

  // Compute enriched stats for the prompt
  interface TradeRow {
    strategy: string;
    ticker: string;
    pl: number;
    plPercent: number;
    daysHeld: number;
    dteAtEntry: number;
    exitReason: string;
    date: string;
    contracts: number;
  }

  const allTrades: TradeRow[] = [];

  for (const t of data.allCSPs.filter(t => t.status === 'closed')) {
    const pl = calculatePL(t);
    allTrades.push({
      strategy: 'CSP', ticker: t.ticker, pl,
      plPercent: t.collateral > 0 ? (pl / t.collateral * 100) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate,
      contracts: t.contracts,
    });
  }
  for (const t of data.allCCs.filter(t => t.status !== 'open')) {
    const pl = calculateCCPL(t);
    allTrades.push({
      strategy: 'CC', ticker: t.ticker, pl,
      plPercent: t.costBasis > 0 ? (pl / t.costBasis * 100) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate,
      contracts: t.contracts,
    });
  }
  for (const t of data.allDir.filter(t => t.status === 'closed')) {
    const pl = calculateDirectionalPL(t);
    allTrades.push({
      strategy: 'Directional', ticker: t.ticker, pl,
      plPercent: t.costAtOpen > 0 ? (pl / t.costAtOpen * 100) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate,
      contracts: t.contracts,
    });
  }
  for (const t of data.allSpreads.filter(t => t.status === 'closed')) {
    const pl = calculateSpreadPL(t);
    const base = t.netDebit < 0 ? t.maxLoss : t.netDebit;
    allTrades.push({
      strategy: 'Spread', ticker: t.ticker, pl,
      plPercent: base > 0 ? (pl / base * 100) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown', date: t.exitDate || t.entryDate,
      contracts: t.contracts,
    });
  }

  if (allTrades.length < 5) {
    return NextResponse.json({
      patterns: [{
        id: '1', title: 'Insufficient Data',
        description: 'Need at least 5 closed trades across all strategies for pattern analysis.',
        trend: 'stable' as const,
      }],
    });
  }

  allTrades.sort((a, b) => a.date.localeCompare(b.date));

  // Compute buckets
  const dteBuckets: Record<string, { trades: number; wins: number; pl: number }> = {};
  const holdTimeBuckets = { winners: [] as number[], losers: [] as number[] };
  const exitReasonPL: Record<string, { count: number; pl: number }> = {};
  const tickerPerf: Record<string, { trades: number; wins: number; pl: number }> = {};
  const monthlyPL: Record<string, number> = {};

  for (const t of allTrades) {
    // DTE buckets
    const bucket = t.dteAtEntry <= 14 ? '0-14' : t.dteAtEntry <= 21 ? '15-21' : t.dteAtEntry <= 30 ? '22-30' : t.dteAtEntry <= 45 ? '31-45' : '45+';
    if (!dteBuckets[bucket]) dteBuckets[bucket] = { trades: 0, wins: 0, pl: 0 };
    dteBuckets[bucket].trades++;
    if (t.pl > 0) dteBuckets[bucket].wins++;
    dteBuckets[bucket].pl += t.pl;

    // Hold time
    if (t.pl > 0) holdTimeBuckets.winners.push(t.daysHeld);
    else holdTimeBuckets.losers.push(t.daysHeld);

    // Exit reasons
    if (!exitReasonPL[t.exitReason]) exitReasonPL[t.exitReason] = { count: 0, pl: 0 };
    exitReasonPL[t.exitReason].count++;
    exitReasonPL[t.exitReason].pl += t.pl;

    // Ticker performance
    if (!tickerPerf[t.ticker]) tickerPerf[t.ticker] = { trades: 0, wins: 0, pl: 0 };
    tickerPerf[t.ticker].trades++;
    if (t.pl > 0) tickerPerf[t.ticker].wins++;
    tickerPerf[t.ticker].pl += t.pl;

    // Monthly P/L
    const month = t.date.slice(0, 7);
    monthlyPL[month] = (monthlyPL[month] || 0) + t.pl;
  }

  const avgWinnerHold = holdTimeBuckets.winners.length > 0
    ? holdTimeBuckets.winners.reduce((a, b) => a + b, 0) / holdTimeBuckets.winners.length
    : 0;
  const avgLoserHold = holdTimeBuckets.losers.length > 0
    ? holdTimeBuckets.losers.reduce((a, b) => a + b, 0) / holdTimeBuckets.losers.length
    : 0;

  const totalWins = allTrades.filter(t => t.pl > 0).length;
  const totalPL = allTrades.reduce((s, t) => s + t.pl, 0);
  const winRate = totalWins / allTrades.length;

  const statsBlock = `
TRADE HISTORY (${allTrades.length} closed trades over 12 months):
Overall: ${totalWins}W/${allTrades.length - totalWins}L (${(winRate * 100).toFixed(1)}% win rate), $${totalPL.toFixed(0)} total P/L

Win Rate by DTE at Entry:
${Object.entries(dteBuckets).map(([k, v]) => `  ${k} DTE: ${v.trades} trades, ${(v.wins / v.trades * 100).toFixed(0)}% win rate, $${v.pl.toFixed(0)} P/L`).join('\n')}

Hold Time: Winners avg ${avgWinnerHold.toFixed(1)} days, Losers avg ${avgLoserHold.toFixed(1)} days

Exit Reasons:
${Object.entries(exitReasonPL).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => `  ${k}: ${v.count} trades, $${v.pl.toFixed(0)} P/L`).join('\n')}

Per-Ticker (top 10):
${Object.entries(tickerPerf).sort((a, b) => b[1].trades - a[1].trades).slice(0, 10).map(([k, v]) => `  ${k}: ${v.trades} trades, ${(v.wins / v.trades * 100).toFixed(0)}% win rate, $${v.pl.toFixed(0)} P/L`).join('\n')}

Monthly P/L:
${Object.entries(monthlyPL).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `  ${k}: $${v.toFixed(0)}`).join('\n')}`;

  // Fetch previous analysis for evolution tracking
  const col2 = await getPatternAnalysesCollection();
  const previousAnalysis = await col2.find({}).sort({ timestamp: -1 }).limit(1).toArray();
  let evolutionBlock = '';
  if (previousAnalysis.length > 0) {
    const prev = previousAnalysis[0];
    const prevDate = new Date(prev.timestamp).toLocaleDateString();
    const prevPatternTitles = prev.patterns.map((p: { title: string }) => p.title).join(', ');
    evolutionBlock = `
PREVIOUS ANALYSIS (from ${prevDate}):
Trade count: ${prev.tradeCount}, Win rate: ${prev.winRate}%, P/L: $${prev.totalPL.toFixed(0)}
Patterns identified: ${prevPatternTitles}

Compare with previous and note improvements or deterioration. Reference prior results when relevant.`;
  }

  const systemPrompt = `You are a behavioral trading analyst. Analyze this trader's complete history and identify 3-5 non-obvious behavioral PATTERNS — not surface-level stats.

${statsBlock}${evolutionBlock}

Return ONLY a JSON array (no markdown, no code blocks):
[
  {
    "id": "1",
    "title": "<pattern name, 5-8 words>",
    "description": "<2-3 sentences explaining the pattern with specific numbers from the data>",
    "trend": "improving" | "worsening" | "stable",
    "metric": "<key number, e.g. '72% win rate under 21 DTE'>"
  }
]

Focus on:
- DTE sweet spots vs blind spots (where win rate diverges significantly)
- Hold time discipline (do they hold losers too long?)
- Exit strategy effectiveness (which exit reasons produce best results?)
- Ticker patterns (consistent winners vs underperformers)
- Behavioral biases (revenge trading, over-sizing after losses, etc.)

Do NOT just restate the stats. Find the INSIGHT behind the numbers.`;

  const result = await aiCall({
    feature: 'patterns',
    model: 'claude-sonnet-4-6',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Analyze my trading patterns.' }],
    maxTokens: 1024,
  });

  if (!result) {
    return NextResponse.json({ error: 'AI not available' }, { status: 500 });
  }

  try {
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const patterns = JSON.parse(jsonStr);

    // Save to MongoDB
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      patterns,
      tradeCount: allTrades.length,
      totalPL: Math.round(totalPL * 100) / 100,
      winRate: Math.round(winRate * 1000) / 10,
    };
    const col = await getPatternAnalysesCollection();
    await col.insertOne(record);

    return NextResponse.json({ patterns, record });
  } catch {
    return NextResponse.json({ patterns: [] });
  }
}
