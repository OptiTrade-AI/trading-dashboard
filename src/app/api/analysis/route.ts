import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCspTradesCollection, getCoveredCallsCollection, getDirectionalTradesCollection, getSpreadsCollection, getAccountSettingsCollection, getAnalysesCollection } from '@/lib/collections';
import { calculatePL, calculateDirectionalPL, calculateSpreadPL, calculateDTE } from '@/lib/utils';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade } from '@/types';
import { subDays, subMonths, startOfYear, isAfter, parseISO, differenceInDays } from 'date-fns';

function calculateCCPL(call: CoveredCall): number {
  if (call.status === 'open') return 0;
  return call.premiumCollected - (call.exitPrice ?? 0);
}

function getDateCutoff(timeRange: string, startDate?: string, endDate?: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  let start: Date | null = null;
  const end: Date | null = endDate ? parseISO(endDate) : null;

  switch (timeRange) {
    case '1W': start = subDays(now, 7); break;
    case '1M': start = subMonths(now, 1); break;
    case '3M': start = subMonths(now, 3); break;
    case '6M': start = subMonths(now, 6); break;
    case 'YTD': start = startOfYear(now); break;
    case 'ALL': start = null; break;
    case 'CUSTOM':
      start = startDate ? parseISO(startDate) : null;
      break;
  }

  return { start, end };
}

function filterByDate<T extends { exitDate?: string; entryDate: string }>(
  items: T[],
  cutoff: { start: Date | null; end: Date | null },
  statusField: 'closed' | 'any' = 'closed'
): { closed: T[]; open: T[] } {
  const closed: T[] = [];
  const open: T[] = [];

  for (const item of items) {
    const status = (item as unknown as { status: string }).status;
    if (status === 'open') {
      open.push(item);
      continue;
    }
    if (statusField === 'closed' && status === 'open') continue;

    const exitDate = item.exitDate ? parseISO(item.exitDate) : null;
    if (!exitDate) continue;

    if (cutoff.start && !isAfter(exitDate, cutoff.start)) continue;
    if (cutoff.end && isAfter(exitDate, cutoff.end)) continue;

    closed.push(item);
  }

  return { closed, open };
}

interface TradeStats {
  strategy: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgDaysHeld: number;
  avgDTEAtEntry: number;
  exitReasons: Record<string, number>;
  tickerStats: { ticker: string; count: number; pl: number }[];
  bestTrade: { ticker: string; pl: number } | null;
  worstTrade: { ticker: string; pl: number } | null;
}

function computeStats<T extends { ticker: string; dteAtEntry: number; entryDate: string; exitDate?: string }>(
  trades: T[],
  plFn: (t: T) => number,
  exitReasonFn: (t: T) => string | undefined,
  strategy: string
): TradeStats {
  if (trades.length === 0) {
    return { strategy, totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPL: 0, avgPL: 0, avgDaysHeld: 0, avgDTEAtEntry: 0, exitReasons: {}, tickerStats: [], bestTrade: null, worstTrade: null };
  }

  const pls = trades.map(t => ({ ticker: t.ticker, pl: plFn(t) }));
  const wins = pls.filter(p => p.pl > 0).length;
  const losses = pls.filter(p => p.pl <= 0).length;
  const totalPL = pls.reduce((s, p) => s + p.pl, 0);

  const exitReasons: Record<string, number> = {};
  for (const t of trades) {
    const reason = exitReasonFn(t) || 'unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  }

  const tickerMap = new Map<string, { count: number; pl: number }>();
  for (const p of pls) {
    const existing = tickerMap.get(p.ticker) || { count: 0, pl: 0 };
    existing.count++;
    existing.pl += p.pl;
    tickerMap.set(p.ticker, existing);
  }
  const tickerStats = Array.from(tickerMap.entries())
    .map(([ticker, stats]) => ({ ticker, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const daysHeldArr = trades.map(t => {
    const entry = parseISO(t.entryDate);
    const exit = t.exitDate ? parseISO(t.exitDate) : new Date();
    return Math.max(1, differenceInDays(exit, entry));
  });

  const sorted = [...pls].sort((a, b) => b.pl - a.pl);

  return {
    strategy,
    totalTrades: trades.length,
    wins,
    losses,
    winRate: (wins / trades.length) * 100,
    totalPL,
    avgPL: totalPL / trades.length,
    avgDaysHeld: daysHeldArr.reduce((s, d) => s + d, 0) / daysHeldArr.length,
    avgDTEAtEntry: trades.reduce((s, t) => s + t.dteAtEntry, 0) / trades.length,
    exitReasons,
    tickerStats,
    bestTrade: sorted[0] ? { ticker: sorted[0].ticker, pl: sorted[0].pl } : null,
    worstTrade: sorted[sorted.length - 1] ? { ticker: sorted[sorted.length - 1].ticker, pl: sorted[sorted.length - 1].pl } : null,
  };
}

interface OpenPositionSummary {
  strategy: string;
  count: number;
  tickers: string[];
  totalCollateralAtRisk: number;
  positions: { ticker: string; dte: number; collateral: number }[];
}

function getOpenCSPSummary(trades: Trade[]): OpenPositionSummary {
  const positions = trades.map(t => ({
    ticker: t.ticker,
    dte: calculateDTE(t.expiration),
    collateral: t.collateral,
  }));
  return {
    strategy: 'Cash-Secured Puts',
    count: trades.length,
    tickers: Array.from(new Set(trades.map(t => t.ticker))),
    totalCollateralAtRisk: positions.reduce((s, p) => s + p.collateral, 0),
    positions,
  };
}

function getOpenCCSummary(calls: CoveredCall[]): OpenPositionSummary {
  const positions = calls.map(c => ({
    ticker: c.ticker,
    dte: calculateDTE(c.expiration),
    collateral: c.costBasis,
  }));
  return {
    strategy: 'Covered Calls',
    count: calls.length,
    tickers: Array.from(new Set(calls.map(c => c.ticker))),
    totalCollateralAtRisk: positions.reduce((s, p) => s + p.collateral, 0),
    positions,
  };
}

function getOpenDirectionalSummary(trades: DirectionalTrade[]): OpenPositionSummary {
  const positions = trades.map(t => ({
    ticker: t.ticker,
    dte: calculateDTE(t.expiration),
    collateral: t.costAtOpen,
  }));
  return {
    strategy: 'Directional',
    count: trades.length,
    tickers: Array.from(new Set(trades.map(t => t.ticker))),
    totalCollateralAtRisk: positions.reduce((s, p) => s + p.collateral, 0),
    positions,
  };
}

function getOpenSpreadSummary(trades: SpreadTrade[]): OpenPositionSummary {
  const positions = trades.map(t => ({
    ticker: t.ticker,
    dte: calculateDTE(t.expiration),
    collateral: t.maxLoss,
  }));
  return {
    strategy: 'Spreads',
    count: trades.length,
    tickers: Array.from(new Set(trades.map(t => t.ticker))),
    totalCollateralAtRisk: positions.reduce((s, p) => s + p.collateral, 0),
    positions,
  };
}

export async function GET() {
  const available = !!process.env.ANTHROPIC_API_KEY;
  const col = await getAnalysesCollection();
  const history = await col.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  return NextResponse.json({ available, history });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { timeRange, startDate, endDate } = body as { timeRange: string; startDate?: string; endDate?: string };

  // Fetch all trades
  const [cspCol, ccCol, dirCol, spCol, settingsCol] = await Promise.all([
    getCspTradesCollection(),
    getCoveredCallsCollection(),
    getDirectionalTradesCollection(),
    getSpreadsCollection(),
    getAccountSettingsCollection(),
  ]);

  const [allCSPs, allCCs, allDir, allSpreads, settings] = await Promise.all([
    cspCol.find({}).toArray(),
    ccCol.find({}).toArray(),
    dirCol.find({}).toArray(),
    spCol.find({}).toArray(),
    settingsCol.findOne({}),
  ]);

  const cutoff = getDateCutoff(timeRange, startDate, endDate);

  const cspFiltered = filterByDate(allCSPs, cutoff);
  const ccFiltered = filterByDate(allCCs, cutoff);
  const dirFiltered = filterByDate(allDir, cutoff);
  const spreadFiltered = filterByDate(allSpreads, cutoff);

  // Compute stats for closed trades in period
  const cspStats = computeStats(cspFiltered.closed, calculatePL, t => t.exitReason, 'Cash-Secured Puts');
  const ccStats = computeStats(ccFiltered.closed, calculateCCPL, t => t.exitReason, 'Covered Calls');
  const dirStats = computeStats(dirFiltered.closed, calculateDirectionalPL, t => t.exitReason, 'Directional');
  const spreadStats = computeStats(spreadFiltered.closed, calculateSpreadPL, t => t.exitReason, 'Spreads');

  // Open positions
  const openCSPs = getOpenCSPSummary(cspFiltered.open);
  const openCCs = getOpenCCSummary(ccFiltered.open);
  const openDir = getOpenDirectionalSummary(dirFiltered.open);
  const openSpreads = getOpenSpreadSummary(spreadFiltered.open);

  const accountValue = settings?.accountValue ?? 0;
  const totalClosedPL = cspStats.totalPL + ccStats.totalPL + dirStats.totalPL + spreadStats.totalPL;
  const totalClosedTrades = cspStats.totalTrades + ccStats.totalTrades + dirStats.totalTrades + spreadStats.totalTrades;
  const totalOpenPositions = openCSPs.count + openCCs.count + openDir.count + openSpreads.count;
  const totalCapitalAtRisk = openCSPs.totalCollateralAtRisk + openCCs.totalCollateralAtRisk + openDir.totalCollateralAtRisk + openSpreads.totalCollateralAtRisk;

  // All open tickers for concentration analysis
  const allOpenTickers = [
    ...openCSPs.positions.map(p => p.ticker),
    ...openCCs.positions.map(p => p.ticker),
    ...openDir.positions.map(p => p.ticker),
    ...openSpreads.positions.map(p => p.ticker),
  ];
  const tickerConcentration: Record<string, number> = {};
  for (const ticker of allOpenTickers) {
    tickerConcentration[ticker] = (tickerConcentration[ticker] || 0) + 1;
  }

  const formatStats = (s: TradeStats) => {
    if (s.totalTrades === 0) return `${s.strategy}: No closed trades in period.\n`;
    return `${s.strategy}:
  Trades: ${s.totalTrades} (${s.wins}W / ${s.losses}L, ${s.winRate.toFixed(1)}% win rate)
  Total P/L: $${s.totalPL.toFixed(0)} | Avg P/L: $${s.avgPL.toFixed(0)}/trade
  Avg Days Held: ${s.avgDaysHeld.toFixed(1)} | Avg DTE at Entry: ${s.avgDTEAtEntry.toFixed(0)}
  Exit Reasons: ${Object.entries(s.exitReasons).map(([r, c]) => `${r}(${c})`).join(', ')}
  Top Tickers: ${s.tickerStats.map(t => `${t.ticker}(${t.count} trades, $${t.pl.toFixed(0)})`).join(', ')}
  Best: ${s.bestTrade ? `${s.bestTrade.ticker} +$${s.bestTrade.pl.toFixed(0)}` : 'N/A'}
  Worst: ${s.worstTrade ? `${s.worstTrade.ticker} $${s.worstTrade.pl.toFixed(0)}` : 'N/A'}
`;
  };

  const formatOpen = (o: OpenPositionSummary) => {
    if (o.count === 0) return '';
    return `${o.strategy}: ${o.count} open positions
  Tickers: ${o.tickers.join(', ')}
  Capital at Risk: $${o.totalCollateralAtRisk.toFixed(0)}
  Positions: ${o.positions.map(p => `${p.ticker}(${p.dte}DTE, $${p.collateral.toFixed(0)})`).join(', ')}
`;
  };

  const dataPrompt = `
=== TRADING DATA (${timeRange}${timeRange === 'CUSTOM' ? ` ${startDate} to ${endDate}` : ''}) ===

ACCOUNT VALUE: $${accountValue.toFixed(0)}

--- CLOSED TRADE PERFORMANCE ---
Total Closed Trades: ${totalClosedTrades}
Combined P/L: $${totalClosedPL.toFixed(0)}
${accountValue > 0 ? `Return on Account: ${((totalClosedPL / accountValue) * 100).toFixed(1)}%` : ''}

${formatStats(cspStats)}
${formatStats(ccStats)}
${formatStats(dirStats)}
${formatStats(spreadStats)}

--- OPEN POSITIONS ---
Total Open: ${totalOpenPositions} positions
Total Capital at Risk: $${totalCapitalAtRisk.toFixed(0)}${accountValue > 0 ? ` (${((totalCapitalAtRisk / accountValue) * 100).toFixed(1)}% of account)` : ''}
Ticker Concentration: ${Object.entries(tickerConcentration).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}(${c})`).join(', ') || 'None'}

${formatOpen(openCSPs)}
${formatOpen(openCCs)}
${formatOpen(openDir)}
${formatOpen(openSpreads)}
`;

  const systemPrompt = `You are a sharp options trading coach. Review this trader's data and give them a focused debrief — not a report, a conversation.

Output exactly 3 sections:

### Scorecard
A compact summary table (one line per strategy that has trades), then a 1-sentence overall verdict.
Format each strategy line as: **Strategy** — X trades, Y% win rate, $Z P/L
After the lines, write one bold sentence: the headline takeaway for the period.

### Top Findings
The 3-5 most important observations, ranked by how much they matter. Mix good and bad. Each finding is a single short paragraph (2-3 sentences max) with a bold lead-in label.
Focus on: which strategies/tickers are earning or bleeding money, whether exit rules are working, hold time patterns, and any position sizing or concentration red flags in open positions. Only mention open position risk if it's genuinely concerning (e.g., >60% capital deployed, heavy single-ticker exposure, imminent expirations).
Do NOT repeat what's already in the scorecard numbers. Add insight the numbers don't show.

### Action Items
Exactly 3 concrete, specific things to do. Each is one sentence. Numbered list. Ranked by expected impact. These should be things the trader can act on this week, not vague advice.

Rules:
- Only reference provided data. No invented numbers.
- Cite specific tickers, dollar amounts, and percentages.
- Keep total output under 400 words.
- Be direct. No hedging, no filler, no "overall solid month" pleasantries.
- If data is limited, say so in one line and give what you can.`;

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: dataPrompt }],
  });

  const analysisId = crypto.randomUUID();
  let accumulated = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            accumulated += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Save to MongoDB after streaming completes
        try {
          const col = await getAnalysesCollection();
          await col.insertOne({
            id: analysisId,
            createdAt: new Date().toISOString(),
            timeRange,
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            content: accumulated,
          });
        } catch {
          // Don't fail the stream if save fails
        }

        // Append metadata delimiter so client can extract the saved ID
        controller.enqueue(encoder.encode(`\n---METADATA---\n${JSON.stringify({ id: analysisId })}`));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body as { id: string };

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const col = await getAnalysesCollection();
  const result = await col.deleteOne({ id });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
