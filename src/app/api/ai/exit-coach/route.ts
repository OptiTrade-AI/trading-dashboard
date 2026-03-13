import { NextRequest, NextResponse } from 'next/server';
import { aiStream } from '@/lib/ai';
import { gatherPortfolioData, getClosedTradesForTicker } from '@/lib/ai-data';
import { calculateDTE } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { position, greeks, stockPrice } = body as {
    position: {
      id: string;
      ticker: string;
      strategy: string;
      strike: number;
      contracts: number;
      expiration: string;
      entryDate: string;
      premiumCollected?: number;
      entryPrice?: number;
      costAtOpen?: number;
      collateral?: number;
      costBasis?: number;
      spreadType?: string;
      longStrike?: number;
      shortStrike?: number;
      netDebit?: number;
      maxProfit?: number;
      maxLoss?: number;
    };
    greeks?: {
      delta?: number | null;
      gamma?: number | null;
      theta?: number | null;
      vega?: number | null;
      iv?: number | null;
      bid?: number | null;
      ask?: number | null;
      midpoint?: number | null;
      unrealizedPL?: number | null;
    };
    stockPrice?: number | null;
  };

  if (!position?.ticker) {
    return NextResponse.json({ error: 'Position data required' }, { status: 400 });
  }

  // Gather portfolio data and ticker history
  const data = await gatherPortfolioData();
  const tickerHistory = getClosedTradesForTicker(data, position.ticker);

  // Build focused prompt
  const now = new Date().toISOString().slice(0, 10);
  const dte = calculateDTE(position.expiration);

  let positionDesc = `${position.strategy} | ${position.ticker} $${position.strike}`;
  if (position.strategy === 'Spread' && position.longStrike) {
    positionDesc = `${position.strategy} | ${position.ticker} $${position.longStrike}/$${position.shortStrike}`;
  }
  positionDesc += ` | ${position.contracts} contracts | DTE: ${dte} (exp ${position.expiration}) | Entry: ${position.entryDate}`;

  if (position.premiumCollected) positionDesc += ` | Premium: $${position.premiumCollected.toFixed(0)}`;
  if (position.collateral) positionDesc += ` | Collateral: $${position.collateral.toFixed(0)}`;
  if (position.costAtOpen) positionDesc += ` | Cost: $${position.costAtOpen.toFixed(0)}`;
  if (position.netDebit != null) positionDesc += ` | Net Debit: $${position.netDebit.toFixed(0)}`;
  if (position.maxProfit) positionDesc += ` | Max Profit: $${position.maxProfit.toFixed(0)}`;
  if (position.maxLoss) positionDesc += ` | Max Loss: $${position.maxLoss.toFixed(0)}`;

  let greeksDesc = '';
  if (greeks) {
    const parts: string[] = [];
    if (greeks.delta != null) parts.push(`Delta ${greeks.delta.toFixed(3)}`);
    if (greeks.gamma != null) parts.push(`Gamma ${greeks.gamma.toFixed(4)}`);
    if (greeks.theta != null) parts.push(`Theta $${greeks.theta.toFixed(2)}/day`);
    if (greeks.vega != null) parts.push(`Vega ${greeks.vega.toFixed(3)}`);
    if (greeks.iv != null) parts.push(`IV ${(greeks.iv * 100).toFixed(1)}%`);
    if (parts.length > 0) greeksDesc = `\nGreeks: ${parts.join(' | ')}`;
    if (greeks.bid != null) greeksDesc += `\nMarket: Bid $${greeks.bid.toFixed(2)} / Ask $${(greeks.ask ?? 0).toFixed(2)} / Mid $${(greeks.midpoint ?? 0).toFixed(2)}`;
    if (greeks.unrealizedPL != null) greeksDesc += `\nUnrealized P/L: ${greeks.unrealizedPL >= 0 ? '+' : ''}$${greeks.unrealizedPL.toFixed(0)}`;
  }
  if (stockPrice) greeksDesc += `\nStock Price: $${stockPrice.toFixed(2)}`;

  let historyDesc = '';
  if (tickerHistory.length > 0) {
    historyDesc = `\n\nHistory with ${position.ticker} (last ${tickerHistory.length} closed trades):`;
    for (const t of tickerHistory.slice(0, 10)) {
      historyDesc += `\n  ${t.strategy} | P/L: ${t.pl >= 0 ? '+' : ''}$${t.pl.toFixed(0)} | Held ${t.daysHeld}d | Exit: ${t.exitReason} | ${t.date}`;
    }
    const totalPL = tickerHistory.reduce((s, t) => s + t.pl, 0);
    const winRate = tickerHistory.filter(t => t.pl > 0).length / tickerHistory.length * 100;
    historyDesc += `\n  Summary: ${tickerHistory.length} trades, $${totalPL.toFixed(0)} total P/L, ${winRate.toFixed(0)}% win rate`;
  }

  // Portfolio context
  const openCount = data.openPositions.length;
  const heat = data.accountValue > 0 ? (data.totalCapitalAtRisk / data.accountValue * 100) : 0;

  const systemPrompt = `You are an expert options exit coach. Given a position and its real-time data, deliver a clear verdict on what to do RIGHT NOW.

Today is ${now}. Account value: $${data.accountValue.toLocaleString()}. Heat: ${heat.toFixed(1)}%. Open positions: ${openCount}.

POSITION:
${positionDesc}${greeksDesc}${historyDesc}

RULES:
- Your verdict MUST be one of: HOLD, CLOSE, or ROLL
- Start your response with the verdict in bold: **HOLD**, **CLOSE**, or **ROLL**
- Give ONE clear reason (1-2 sentences max)
- If ROLL: suggest specific parameters (new strike, expiration, expected credit)
- Consider: profit capture %, DTE, theta decay acceleration, delta risk, IV, trader's history with this ticker
- For sold premium (CSP, CC, credit spreads): 50%+ profit capture with <14 DTE is usually a close signal
- For bought options (directional, debit spreads): theta decay accelerates under 21 DTE
- Be decisive. Traders need conviction, not hedging
- Keep response under 100 words total`;

  const { stream } = aiStream({
    feature: 'exit-coach',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: `What should I do with this ${position.strategy} position on ${position.ticker}?` }],
    maxTokens: 512,
    ticker: position.ticker,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
