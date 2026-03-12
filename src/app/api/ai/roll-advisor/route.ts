import { NextRequest, NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData, getClosedTradesForTicker } from '@/lib/ai-data';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { position, greeks, stockPrice } = body as {
    position: {
      ticker: string;
      strategy: string;
      strike: number;
      contracts: number;
      expiration: string;
      entryDate: string;
      premiumCollected?: number;
      collateral?: number;
      costAtOpen?: number;
      entryPrice?: number;
      spreadType?: string;
      longStrike?: number;
      shortStrike?: number;
      rollNumber?: number;
    };
    greeks?: {
      delta?: number | null;
      theta?: number | null;
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

  const data = await gatherPortfolioData();
  const tickerHistory = getClosedTradesForTicker(data, position.ticker);
  const rollHistory = tickerHistory.filter(t => t.exitReason === 'rolled');

  const dte = Math.max(0, Math.round((new Date(position.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  let posDesc = `${position.strategy} | ${position.ticker} $${position.strike} | ${position.contracts} contracts | DTE ${dte} | Exp ${position.expiration}`;
  if (position.premiumCollected) posDesc += ` | Premium $${position.premiumCollected.toFixed(0)}`;
  if (position.collateral) posDesc += ` | Collateral $${position.collateral.toFixed(0)}`;
  if (position.rollNumber) posDesc += ` | Roll #${position.rollNumber}`;

  let greeksDesc = '';
  if (greeks) {
    const parts: string[] = [];
    if (greeks.delta != null) parts.push(`Delta ${greeks.delta.toFixed(3)}`);
    if (greeks.theta != null) parts.push(`Theta $${greeks.theta.toFixed(2)}/day`);
    if (greeks.iv != null) parts.push(`IV ${(greeks.iv * 100).toFixed(1)}%`);
    if (parts.length > 0) greeksDesc = `\nGreeks: ${parts.join(' | ')}`;
    if (greeks.bid != null) greeksDesc += `\nMarket: Bid $${greeks.bid.toFixed(2)} / Ask $${(greeks.ask ?? 0).toFixed(2)}`;
    if (greeks.unrealizedPL != null) greeksDesc += ` | Unrealized P/L: ${greeks.unrealizedPL >= 0 ? '+' : ''}$${greeks.unrealizedPL.toFixed(0)}`;
  }
  if (stockPrice) greeksDesc += `\nStock: $${stockPrice.toFixed(2)}`;

  let rollDesc = '';
  if (rollHistory.length > 0) {
    rollDesc = `\nPast rolls on ${position.ticker}: ${rollHistory.length} times`;
  }

  const systemPrompt = `You are an options roll advisor. Given a position to be rolled, recommend specific new parameters.

${posDesc}${greeksDesc}${rollDesc}

Return ONLY a JSON object (no markdown):
{
  "action": "<brief action description>",
  "targetStrike": <number>,
  "targetExpiration": "<YYYY-MM-DD, typically 2-4 weeks out from current expiration>",
  "expectedCredit": <number, estimated net credit for the roll>,
  "reasoning": "<2-3 sentences explaining why these specific parameters>"
}

Guidelines for ${position.strategy}:
- CSP: Roll down and out for credit. Target 0.20-0.30 delta on new position.
- CC: Roll up and out if stock rising, same strike and out if neutral.
- Directional: Roll to same delta at later expiration.
- Generally: Avoid rolling more than 3 times on same position.
- New expiration should be 14-45 DTE from today.
- Strike should reflect current stock price and desired delta.`;

  const result = await aiCall({
    feature: 'roll-advisor',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: `Recommend roll parameters for my ${position.strategy} on ${position.ticker}.` }],
    maxTokens: 300,
    ticker: position.ticker,
  });

  if (!result) {
    return NextResponse.json({ error: 'AI not available' }, { status: 500 });
  }

  try {
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const recommendation = JSON.parse(jsonStr);
    return NextResponse.json(recommendation);
  } catch {
    return NextResponse.json({
      action: 'Could not generate recommendation',
      targetStrike: position.strike,
      targetExpiration: position.expiration,
      expectedCredit: 0,
      reasoning: 'AI response could not be parsed. Consider rolling to a similar strike 2-4 weeks out.',
    });
  }
}
