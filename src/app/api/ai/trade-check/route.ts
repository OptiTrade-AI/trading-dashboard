import { NextRequest, NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData, getClosedTradesForTicker } from '@/lib/ai-data';
import type { TradeCheckResult } from '@/types';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { trade } = body as {
    trade: {
      ticker: string;
      strategy: string;
      strike?: number;
      contracts: number;
      expiration: string;
      premium?: number;
      collateral?: number;
      costAtOpen?: number;
      entryPrice?: number;
      spreadType?: string;
      longStrike?: number;
      shortStrike?: number;
      netDebit?: number;
      maxLoss?: number;
    };
  };

  if (!trade?.ticker) {
    return NextResponse.json({ error: 'Trade data required' }, { status: 400 });
  }

  const data = await gatherPortfolioData();
  const tickerHistory = getClosedTradesForTicker(data, trade.ticker);
  const dte = Math.max(0, Math.round((new Date(trade.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const tickerConc = data.tickerConcentration[trade.ticker] || 0;
  const existingOpen = data.openPositions.filter(p => (p.ticker as string) === trade.ticker).length;

  // Calculate new capital at risk based on strategy
  let newCapital = 0;
  if (trade.collateral) newCapital = trade.collateral;          // CSP
  else if (trade.costAtOpen) newCapital = trade.costAtOpen;     // Directional
  else if (trade.maxLoss) newCapital = trade.maxLoss;           // Spread
  const newHeat = data.accountValue > 0
    ? ((data.totalCapitalAtRisk + newCapital) / data.accountValue * 100)
    : 0;

  let tradeDesc = `${trade.strategy} on ${trade.ticker}`;
  if (trade.strike) tradeDesc += ` $${trade.strike}`;
  if (trade.spreadType && trade.longStrike) tradeDesc += ` ${trade.longStrike}/${trade.shortStrike}`;
  tradeDesc += ` x${trade.contracts} | DTE ${dte} | Exp ${trade.expiration}`;
  if (trade.premium) tradeDesc += ` | Premium $${trade.premium}`;
  if (trade.collateral) tradeDesc += ` | Collateral $${trade.collateral}`;
  if (trade.costAtOpen) tradeDesc += ` | Cost $${trade.costAtOpen}`;
  if (trade.netDebit != null) tradeDesc += ` | Net Debit $${trade.netDebit}`;
  if (trade.maxLoss) tradeDesc += ` | Max Loss $${trade.maxLoss}`;

  let historyDesc = '';
  if (tickerHistory.length > 0) {
    const totalPL = tickerHistory.reduce((s, t) => s + t.pl, 0);
    const winRate = tickerHistory.filter(t => t.pl > 0).length / tickerHistory.length * 100;
    historyDesc = `\nHistory with ${trade.ticker}: ${tickerHistory.length} trades, $${totalPL.toFixed(0)} total P/L, ${winRate.toFixed(0)}% win rate`;
    const byDTE = tickerHistory.filter(t => t.daysHeld <= dte);
    if (byDTE.length > 0) {
      const dteWinRate = byDTE.filter(t => t.pl > 0).length / byDTE.length * 100;
      historyDesc += ` (at similar DTE: ${dteWinRate.toFixed(0)}% win rate on ${byDTE.length} trades)`;
    }
  }

  const systemPrompt = `You are a trade entry advisor. Evaluate this proposed trade and return a JSON assessment.

Account: $${data.accountValue.toLocaleString()} | Current heat: ${((data.totalCapitalAtRisk / (data.accountValue || 1)) * 100).toFixed(1)}% | After trade: ${newHeat.toFixed(1)}% | Max heat: ${data.maxHeatPercent}%
Open positions: ${data.openPositions.length} | Existing ${trade.ticker} positions: ${tickerConc} total (${existingOpen} open)

Proposed trade: ${tradeDesc}${historyDesc}

Return ONLY a JSON object (no markdown, no code blocks):
{
  "recommendation": "proceed" | "caution" | "reconsider",
  "sizingNote": "<one sentence about position sizing and heat>",
  "historyNote": "<one sentence about historical performance on this ticker, or 'No history on this ticker' if none>",
  "portfolioNote": "<one sentence about concentration and portfolio fit>"
}

Guidelines:
- "proceed": trade looks reasonable given history, sizing, and portfolio
- "caution": some concerns but not dealbreakers
- "reconsider": significant issues (heat exceeds limit, poor ticker history, over-concentration)
- Be specific with numbers from the data`;

  const result = await aiCall({
    feature: 'trade-check',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: `Evaluate this ${trade.strategy} trade on ${trade.ticker}.` }],
    maxTokens: 300,
    ticker: trade.ticker,
  });

  if (!result) {
    return NextResponse.json({ error: 'AI not available' }, { status: 500 });
  }

  try {
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const check: TradeCheckResult = JSON.parse(jsonStr);
    return NextResponse.json(check);
  } catch {
    return NextResponse.json({
      recommendation: 'caution',
      sizingNote: 'Could not analyze sizing.',
      historyNote: 'Could not analyze history.',
      portfolioNote: 'Could not analyze portfolio fit.',
    } as TradeCheckResult);
  }
}
