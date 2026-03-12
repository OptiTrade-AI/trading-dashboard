import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getConversationsCollection, getCspTradesCollection, getCoveredCallsCollection, getDirectionalTradesCollection, getSpreadsCollection, getAccountSettingsCollection, getStockEventsCollection, getHoldingsCollection } from '@/lib/collections';
import { calculatePL, calculateDirectionalPL, calculateSpreadPL, calculateDTE } from '@/lib/utils';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, ChatMessage } from '@/types';
import { differenceInDays, parseISO, subMonths } from 'date-fns';

function calculateCCPL(call: CoveredCall): number {
  if (call.status === 'open') return 0;
  return call.premiumCollected - (call.exitPrice ?? 0);
}

// Build portfolio context from server-side data + client-provided live data
function buildSystemPrompt(portfolioContext: Record<string, unknown>): string {
  const ctx = portfolioContext;
  const now = new Date().toISOString().slice(0, 16);

  let prompt = `You are an expert options trading coach with complete real-time visibility into this trader's portfolio. You know every position, every Greek, every risk metric. Give direct, specific, actionable advice. Never hedge or give generic answers when you have specific data.

Today is ${now}. Market status: ${ctx.marketStatus || 'unknown'}.

=== ACCOUNT ===
Value: $${Number(ctx.accountValue || 0).toLocaleString()}
Heat: ${Number(ctx.heat || 0).toFixed(1)}% (limit: ${ctx.maxHeatPercent || 30}%)
Total Capital at Risk: $${Number(ctx.totalCapitalAtRisk || 0).toLocaleString()}`;

  // Open positions with live Greeks
  const openPositions = (ctx.openPositions as Record<string, unknown>[]) || [];
  if (openPositions.length > 0) {
    prompt += `\n\n=== OPEN POSITIONS (${openPositions.length} total) ===`;
    for (const pos of openPositions) {
      prompt += `\n${pos.strategy} | ${pos.ticker} ${pos.label} | ${pos.contracts} contracts | DTE: ${pos.dte} (exp ${pos.expiration}) | Entry: ${pos.entryDate}`;
      prompt += `\n  Capital: $${Number(pos.capitalAtRisk || 0).toLocaleString()}`;
      if (pos.unrealizedPL != null) prompt += ` | Unrealized P/L: ${Number(pos.unrealizedPL) >= 0 ? '+' : ''}$${Number(pos.unrealizedPL).toFixed(0)}`;
      const greekParts: string[] = [];
      if (pos.delta != null) greekParts.push(`Delta ${Number(pos.delta).toFixed(3)}`);
      if (pos.gamma != null) greekParts.push(`Gamma ${Number(pos.gamma).toFixed(4)}`);
      if (pos.theta != null) greekParts.push(`Theta $${Number(pos.theta).toFixed(2)}/day`);
      if (pos.vega != null) greekParts.push(`Vega ${Number(pos.vega).toFixed(3)}`);
      if (pos.iv != null) greekParts.push(`IV ${(Number(pos.iv) * 100).toFixed(1)}%`);
      if (greekParts.length > 0) prompt += `\n  Greeks: ${greekParts.join(' | ')}`;
      if (pos.bid != null || pos.ask != null) {
        prompt += `\n  Market: Bid $${Number(pos.bid || 0).toFixed(2)} / Ask $${Number(pos.ask || 0).toFixed(2)}`;
        if (pos.midpoint != null) prompt += ` / Mid $${Number(pos.midpoint).toFixed(2)}`;
      }
      if (pos.currentStockPrice != null) prompt += ` | Stock: $${Number(pos.currentStockPrice).toFixed(2)}`;
    }
  }

  // Pressure positions
  const pressurePositions = (ctx.pressurePositions as Record<string, unknown>[]) || [];
  if (pressurePositions.length > 0) {
    prompt += `\n\n=== POSITIONS UNDER PRESSURE ===`;
    for (const p of pressurePositions) {
      prompt += `\n[${String(p.severity).toUpperCase()}] ${p.ticker} ${p.label} | Stock at $${Number(p.currentPrice).toFixed(2)} (${Number(p.priceToStrikePercent).toFixed(1)}% of strike) | ${p.dte} DTE`;
    }
  }

  // Holdings
  const holdings = (ctx.holdings as Record<string, unknown>[]) || [];
  if (holdings.length > 0) {
    prompt += `\n\n=== STOCK HOLDINGS ===`;
    for (const h of holdings) {
      prompt += `\n${h.ticker}: ${h.shares} shares @ $${Number(h.costBasisPerShare).toFixed(2)}`;
      if (h.currentPrice != null) prompt += ` (current: $${Number(h.currentPrice).toFixed(2)}, P/L: ${Number(h.unrealizedPL) >= 0 ? '+' : ''}$${Number(h.unrealizedPL || 0).toFixed(0)})`;
    }
  }

  // Closed trade performance
  const closedStats = ctx.closedStats as Record<string, unknown> | undefined;
  if (closedStats) {
    prompt += `\n\n=== CLOSED TRADE PERFORMANCE ===`;
    const strategies = ['csp', 'cc', 'directional', 'spreads'];
    const labels: Record<string, string> = { csp: 'Cash-Secured Puts', cc: 'Covered Calls', directional: 'Directional', spreads: 'Spreads' };
    for (const key of strategies) {
      const s = closedStats[key] as Record<string, unknown> | undefined;
      if (s && Number(s.totalTrades) > 0) {
        prompt += `\n${labels[key]}: ${s.totalTrades} trades (${s.wins}W/${s.losses}L, ${Number(s.winRate).toFixed(1)}% win rate)`;
        prompt += `\n  Total P/L: $${Number(s.totalPL).toFixed(0)} | Avg P/L: $${Number(s.avgPL).toFixed(0)}/trade`;
        prompt += `\n  Avg Days Held: ${Number(s.avgDaysHeld).toFixed(1)} | Avg DTE at Entry: ${Number(s.avgDTEAtEntry).toFixed(0)}`;
        if (s.exitReasons) {
          const reasons = Object.entries(s.exitReasons as Record<string, number>).map(([r, c]) => `${r}(${c})`).join(', ');
          prompt += `\n  Exit Reasons: ${reasons}`;
        }
        if (s.topTickers && (s.topTickers as unknown[]).length > 0) {
          const tickers = (s.topTickers as { ticker: string; count: number; pl: number }[])
            .map(t => `${t.ticker}(${t.count}, $${t.pl.toFixed(0)})`).join(', ');
          prompt += `\n  Top Tickers: ${tickers}`;
        }
      }
    }
    if (closedStats.totalPL != null) {
      prompt += `\nCombined: ${closedStats.totalTrades} trades, $${Number(closedStats.totalPL).toFixed(0)} P/L`;
    }
  }

  // Ticker concentration
  const concentration = ctx.tickerConcentration as Record<string, number> | undefined;
  if (concentration && Object.keys(concentration).length > 0) {
    const sorted = Object.entries(concentration).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}(${c})`).join(', ');
    prompt += `\n\n=== TICKER CONCENTRATION ===\n${sorted}`;
  }

  // Stock events
  const stockEvents = (ctx.stockEvents as Record<string, unknown>[]) || [];
  if (stockEvents.length > 0) {
    prompt += `\n\n=== RECENT STOCK EVENTS ===`;
    for (const e of stockEvents) {
      prompt += `\n${e.ticker}: ${e.shares} shares, P/L $${Number(e.realizedPL).toFixed(0)}, ${e.saleDate}${e.isTaxLossHarvest ? ' (TLH)' : ''}`;
    }
  }

  prompt += `

=== RESPONSE FORMAT ===
- Reference specific positions by ticker, strike, and expiration when discussing them
- Use dollar amounts and percentages from the actual data
- For risk analysis, consider Greeks, DTE, and current price relative to strikes
- Format responses with markdown: use **bold** for key points, tables for comparisons, bullet lists for action items
- When suggesting actions, be specific: "Roll your AAPL $150P 3/21 to the $145P 4/18" not "consider rolling"
- If the trader asks about a position you don't have data for, say so
- Never make up prices, Greeks, or P/L numbers
- Keep responses focused and under 500 words unless the question warrants more detail
- At the end of EVERY response, on a new line, include exactly 3 suggested follow-up questions in this hidden format:
  <!--FOLLOWUPS: question 1 | question 2 | question 3-->
  These should be contextually relevant to what was just discussed.`;

  return prompt;
}

// Compute closed trade stats for context (reused from analysis route)
interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgDaysHeld: number;
  avgDTEAtEntry: number;
  exitReasons: Record<string, number>;
  topTickers: { ticker: string; count: number; pl: number }[];
}

function computeClosedStats<T extends { ticker: string; dteAtEntry: number; entryDate: string; exitDate?: string }>(
  trades: T[],
  plFn: (t: T) => number,
  exitReasonFn: (t: T) => string | undefined,
): TradeStats {
  if (trades.length === 0) {
    return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPL: 0, avgPL: 0, avgDaysHeld: 0, avgDTEAtEntry: 0, exitReasons: {}, topTickers: [] };
  }
  const pls = trades.map(t => ({ ticker: t.ticker, pl: plFn(t) }));
  const wins = pls.filter(p => p.pl > 0).length;
  const totalPL = pls.reduce((s, p) => s + p.pl, 0);
  const exitReasons: Record<string, number> = {};
  for (const t of trades) {
    const reason = exitReasonFn(t) || 'unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  }
  const tickerMap = new Map<string, { count: number; pl: number }>();
  for (const p of pls) {
    const e = tickerMap.get(p.ticker) || { count: 0, pl: 0 };
    e.count++; e.pl += p.pl;
    tickerMap.set(p.ticker, e);
  }
  const topTickers = Array.from(tickerMap.entries()).map(([ticker, s]) => ({ ticker, ...s })).sort((a, b) => b.count - a.count).slice(0, 10);
  const daysHeld = trades.map(t => {
    const entry = parseISO(t.entryDate);
    const exit = t.exitDate ? parseISO(t.exitDate) : new Date();
    return Math.max(1, differenceInDays(exit, entry));
  });
  return {
    totalTrades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: (wins / trades.length) * 100,
    totalPL,
    avgPL: totalPL / trades.length,
    avgDaysHeld: daysHeld.reduce((s, d) => s + d, 0) / daysHeld.length,
    avgDTEAtEntry: trades.reduce((s, t) => s + t.dteAtEntry, 0) / trades.length,
    exitReasons,
    topTickers,
  };
}

export async function GET() {
  const available = !!process.env.ANTHROPIC_API_KEY;
  const col = await getConversationsCollection();
  const conversations = await col.find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
  return NextResponse.json({ available, conversations });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { conversationId, message, portfolioContext } = body as {
    conversationId?: string;
    message: string;
    portfolioContext: Record<string, unknown>;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // If no closed stats provided by client, compute server-side
  if (!portfolioContext.closedStats) {
    const cutoff = subMonths(new Date(), 3);
    const [cspCol, ccCol, dirCol, spCol, settingsCol, eventsCol, holdingsCol] = await Promise.all([
      getCspTradesCollection(), getCoveredCallsCollection(), getDirectionalTradesCollection(),
      getSpreadsCollection(), getAccountSettingsCollection(), getStockEventsCollection(), getHoldingsCollection(),
    ]);
    const [allCSPs, allCCs, allDir, allSpreads, settings, events, holdings] = await Promise.all([
      cspCol.find({}).toArray(), ccCol.find({}).toArray(), dirCol.find({}).toArray(),
      spCol.find({}).toArray(), settingsCol.findOne({}), eventsCol.find({}).toArray(), holdingsCol.find({}).toArray(),
    ]);

    const closedCSPs = allCSPs.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);
    const closedCCs = allCCs.filter(t => t.status !== 'open' && t.exitDate && parseISO(t.exitDate) >= cutoff);
    const closedDir = allDir.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);
    const closedSpreads = allSpreads.filter(t => t.status === 'closed' && t.exitDate && parseISO(t.exitDate) >= cutoff);

    portfolioContext.closedStats = {
      csp: computeClosedStats(closedCSPs, calculatePL, t => t.exitReason),
      cc: computeClosedStats(closedCCs, calculateCCPL, t => t.exitReason),
      directional: computeClosedStats(closedDir, calculateDirectionalPL, t => t.exitReason),
      spreads: computeClosedStats(closedSpreads, calculateSpreadPL, t => t.exitReason),
      totalPL: closedCSPs.reduce((s, t) => s + calculatePL(t), 0) + closedCCs.reduce((s, t) => s + calculateCCPL(t), 0) + closedDir.reduce((s, t) => s + calculateDirectionalPL(t), 0) + closedSpreads.reduce((s, t) => s + calculateSpreadPL(t), 0),
      totalTrades: closedCSPs.length + closedCCs.length + closedDir.length + closedSpreads.length,
    };
    portfolioContext.accountValue = portfolioContext.accountValue || settings?.accountValue || 0;
    portfolioContext.maxHeatPercent = portfolioContext.maxHeatPercent || settings?.maxHeatPercent || 30;

    // Add holdings if not provided
    if (!portfolioContext.holdings && holdings.length > 0) {
      portfolioContext.holdings = holdings.map(h => ({
        ticker: h.ticker, shares: h.shares, costBasisPerShare: h.costBasisPerShare,
      }));
    }

    // Add stock events if not provided
    if (!portfolioContext.stockEvents && events.length > 0) {
      portfolioContext.stockEvents = events.slice(0, 10).map(e => ({
        ticker: e.ticker, shares: e.shares, realizedPL: e.realizedPL, saleDate: e.saleDate, isTaxLossHarvest: e.isTaxLossHarvest,
      }));
    }

    // Build open positions from server data
    if (!portfolioContext.openPositions) {
      const openPositions: Record<string, unknown>[] = [];
      for (const t of allCSPs.filter(t => t.status === 'open')) {
        openPositions.push({
          id: t.id, ticker: t.ticker, strategy: 'CSP', label: `$${t.strike}P`, contracts: t.contracts,
          dte: calculateDTE(t.expiration), expiration: t.expiration, entryDate: t.entryDate,
          capitalAtRisk: t.collateral,
        });
      }
      for (const c of allCCs.filter(c => c.status === 'open')) {
        openPositions.push({
          id: c.id, ticker: c.ticker, strategy: 'CC', label: `$${c.strike}C`, contracts: c.contracts,
          dte: calculateDTE(c.expiration), expiration: c.expiration, entryDate: c.entryDate,
          capitalAtRisk: c.costBasis,
        });
      }
      for (const t of allDir.filter(t => t.status === 'open')) {
        openPositions.push({
          id: t.id, ticker: t.ticker, strategy: 'Directional', label: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'}`, contracts: t.contracts,
          dte: calculateDTE(t.expiration), expiration: t.expiration, entryDate: t.entryDate,
          capitalAtRisk: t.costAtOpen,
        });
      }
      for (const s of allSpreads.filter(s => s.status === 'open')) {
        openPositions.push({
          id: s.id, ticker: s.ticker, strategy: 'Spread', label: `${s.longStrike}/${s.shortStrike}`, contracts: s.contracts,
          dte: calculateDTE(s.expiration), expiration: s.expiration, entryDate: s.entryDate,
          capitalAtRisk: s.maxLoss,
        });
      }
      portfolioContext.openPositions = openPositions;
      portfolioContext.totalCapitalAtRisk = openPositions.reduce((s, p) => s + Number(p.capitalAtRisk || 0), 0);

      // Ticker concentration
      const conc: Record<string, number> = {};
      for (const p of openPositions) { conc[p.ticker as string] = (conc[p.ticker as string] || 0) + 1; }
      portfolioContext.tickerConcentration = conc;
    }
  }

  // Load existing conversation or create new
  const col = await getConversationsCollection();
  let existingMessages: ChatMessage[] = [];
  let convId = conversationId || crypto.randomUUID();

  if (conversationId) {
    const existing = await col.findOne({ id: conversationId });
    if (existing) {
      existingMessages = existing.messages;
    }
  }

  // Build messages array for Claude
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message,
    createdAt: new Date().toISOString(),
  };

  const claudeMessages = [
    ...existingMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const systemPrompt = buildSystemPrompt(portfolioContext);
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const assistantMsgId = crypto.randomUUID();
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

        // Save conversation to MongoDB
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: accumulated,
          createdAt: new Date().toISOString(),
        };

        const allMessages = [...existingMessages, userMsg, assistantMsg];
        const title = existingMessages.length === 0
          ? message.slice(0, 60) + (message.length > 60 ? '...' : '')
          : undefined;

        try {
          if (conversationId) {
            await col.updateOne(
              { id: conversationId },
              {
                $set: {
                  messages: allMessages,
                  updatedAt: new Date().toISOString(),
                },
              }
            );
          } else {
            await col.insertOne({
              id: convId,
              title: title || message.slice(0, 60),
              messages: allMessages,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Don't fail the stream if save fails
        }

        // Send metadata
        controller.enqueue(encoder.encode(`\n---METADATA---\n${JSON.stringify({ conversationId: convId, userMsgId: userMsg.id, assistantMsgId })}`));
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
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const col = await getConversationsCollection();
  const result = await col.deleteOne({ id });
  if (result.deletedCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, title } = body as { id: string; title: string };
  if (!id || !title) return NextResponse.json({ error: 'Missing id or title' }, { status: 400 });

  const col = await getConversationsCollection();
  await col.updateOne({ id }, { $set: { title } });
  return NextResponse.json({ success: true });
}
