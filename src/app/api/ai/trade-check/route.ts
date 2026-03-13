import { NextRequest, NextResponse } from 'next/server';
import { aiCall, extractJSON } from '@/lib/ai';
import { gatherPortfolioData, getClosedTradesForTicker } from '@/lib/ai-data';
import { calculateDTE } from '@/lib/utils';
import { fetchOptionsChain } from '@/lib/polygon';
import type { TradeCheckResult, TradeCheckMetrics } from '@/types';

interface TradeInput {
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
  costBasisPerShare?: number;
}

async function fetchStockPrice(ticker: string): Promise<number | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.c ?? null;
  } catch {
    return null;
  }
}

function computeMetrics(trade: TradeInput, dte: number, stockPrice: number | null, newHeatPercent: number, matchedContract: { delta: number | null; theta: number | null; iv: number | null } | null): TradeCheckMetrics {
  const metrics: TradeCheckMetrics = {
    stockPrice,
    distanceToStrike: null,
    dte,
    newHeatPercent,
    delta: matchedContract?.delta ?? null,
    theta: matchedContract?.theta ?? null,
    iv: matchedContract?.iv ?? null,
  };

  const strategy = trade.strategy?.toUpperCase();

  if (strategy === 'CSP' && trade.strike != null && stockPrice != null) {
    metrics.distanceToStrike = ((stockPrice - trade.strike) / stockPrice) * 100;
    if (trade.premium != null && trade.collateral && trade.collateral > 0) {
      metrics.roc = (trade.premium / trade.collateral) * 100;
      if (dte > 0) metrics.annualizedROC = metrics.roc * (365 / dte);
    }
  } else if (strategy === 'CC' && trade.strike != null && stockPrice != null) {
    metrics.distanceToStrike = ((trade.strike - stockPrice) / stockPrice) * 100;
    if (trade.costBasisPerShare != null) {
      metrics.costBasisPerShare = trade.costBasisPerShare;
      metrics.strikeVsCostBasis = trade.strike - trade.costBasisPerShare;
      const shares = trade.contracts * 100;
      metrics.calledAwayPL = (trade.strike - trade.costBasisPerShare) * shares + (trade.premium ?? 0);
    }
    const costBasis = trade.costBasisPerShare != null ? trade.costBasisPerShare * trade.contracts * 100 : 0;
    if (trade.premium != null && costBasis > 0) {
      metrics.ros = (trade.premium / costBasis) * 100;
      if (dte > 0) metrics.annualizedROS = metrics.ros * (365 / dte);
    }
  } else if (trade.strike != null && stockPrice != null) {
    // Directional/Spread: basic distance
    metrics.distanceToStrike = ((trade.strike - stockPrice) / stockPrice) * 100;
  }

  return metrics;
}

function buildCSPPrompt(trade: TradeInput, metrics: TradeCheckMetrics, heatInfo: string, historyDesc: string, existingOpen: number): string {
  let context = `Strategy: Cash-Secured Put (CSP)\n${heatInfo}\n`;
  if (metrics.stockPrice != null) context += `Stock price: $${metrics.stockPrice.toFixed(2)}\n`;
  if (metrics.distanceToStrike != null) context += `Distance to strike: ${metrics.distanceToStrike.toFixed(1)}% OTM\n`;
  if (metrics.delta != null) context += `Delta: ${metrics.delta.toFixed(3)}\n`;
  if (metrics.iv != null) context += `IV: ${(metrics.iv * 100).toFixed(1)}%\n`;
  if (trade.premium != null && trade.collateral) {
    context += `Premium: $${trade.premium.toFixed(0)} for $${trade.collateral.toFixed(0)} collateral\n`;
    if (metrics.roc != null) context += `ROC: ${metrics.roc.toFixed(2)}%\n`;
    if (metrics.annualizedROC != null) context += `Annualized ROC: ${metrics.annualizedROC.toFixed(1)}%\n`;
  }
  context += `DTE: ${metrics.dte} | Contracts: ${trade.contracts}\n`;
  if (existingOpen > 0) context += `Existing open ${trade.ticker} positions: ${existingOpen}\n`;
  if (historyDesc) context += historyDesc + '\n';

  return `You are a CSP trade advisor. Evaluate this proposed cash-secured put.

${context}
Return ONLY a JSON object (no markdown, no code blocks):
{
  "recommendation": "proceed" | "caution" | "reconsider",
  "headline": "One-sentence assessment with specific numbers",
  "insights": [
    { "label": "<label>", "text": "Specific analysis" }
  ]
}

Use 3-5 insights. Allowed labels: "Premium", "Assignment Risk", "Return Profile", "Sizing", "Ticker History", "IV Analysis", "Delta".

Guidelines:
- "proceed": attractive premium, reasonable delta (~0.15-0.30), good sizing
- "caution": some concerns (high delta, elevated heat, thin premium)
- "reconsider": poor risk/reward, over-concentrated, heat exceeds limit
- Reference specific numbers from the data. Be concise.`;
}

function buildCCPrompt(trade: TradeInput, metrics: TradeCheckMetrics, heatInfo: string, historyDesc: string, existingOpen: number): string {
  let context = `Strategy: Covered Call (CC)\n${heatInfo}\n`;
  if (metrics.stockPrice != null) context += `Stock price: $${metrics.stockPrice.toFixed(2)}\n`;
  if (metrics.distanceToStrike != null) context += `Distance to strike: ${metrics.distanceToStrike.toFixed(1)}% OTM\n`;
  if (metrics.delta != null) context += `Delta: ${metrics.delta.toFixed(3)}\n`;
  if (metrics.iv != null) context += `IV: ${(metrics.iv * 100).toFixed(1)}%\n`;
  if (metrics.costBasisPerShare != null && trade.strike != null) {
    context += `Cost basis: $${metrics.costBasisPerShare.toFixed(2)}/share\n`;
    context += `Strike vs cost basis: ${(metrics.strikeVsCostBasis ?? 0) >= 0 ? '+' : ''}$${(metrics.strikeVsCostBasis ?? 0).toFixed(2)}\n`;
  }
  if (trade.premium != null) context += `Premium: $${trade.premium.toFixed(0)}\n`;
  if (metrics.ros != null) context += `ROS: ${metrics.ros.toFixed(2)}%\n`;
  if (metrics.annualizedROS != null) context += `Annualized ROS: ${metrics.annualizedROS.toFixed(1)}%\n`;
  if (metrics.calledAwayPL != null) context += `Called-away P/L: ${metrics.calledAwayPL >= 0 ? '+' : ''}$${metrics.calledAwayPL.toFixed(0)}\n`;
  context += `DTE: ${metrics.dte} | Contracts: ${trade.contracts}\n`;
  if (existingOpen > 0) context += `Existing open ${trade.ticker} positions: ${existingOpen}\n`;
  if (historyDesc) context += historyDesc + '\n';

  return `You are a covered call trade advisor. Evaluate this proposed covered call.

${context}
Return ONLY a JSON object (no markdown, no code blocks):
{
  "recommendation": "proceed" | "caution" | "reconsider",
  "headline": "One-sentence assessment with specific numbers",
  "insights": [
    { "label": "<label>", "text": "Specific analysis" }
  ]
}

Use 3-5 insights. Allowed labels: "Upside Cap", "Assignment Scenario", "Premium Quality", "Sizing", "Ticker History", "IV Analysis", "Return Profile".

Guidelines:
- "proceed": good premium, strike above cost basis, acceptable upside cap
- "caution": some concerns (strike near/below cost basis, thin premium, high concentration)
- "reconsider": would lock in loss if called, poor premium, over-concentrated
- Reference specific numbers from the data. Be concise.`;
}

function buildGenericPrompt(trade: TradeInput, metrics: TradeCheckMetrics, heatInfo: string, historyDesc: string, existingOpen: number): string {
  let tradeDesc = `${trade.strategy} on ${trade.ticker}`;
  if (trade.strike) tradeDesc += ` $${trade.strike}`;
  if (trade.spreadType && trade.longStrike) tradeDesc += ` ${trade.longStrike}/${trade.shortStrike}`;
  tradeDesc += ` x${trade.contracts} | DTE ${metrics.dte} | Exp ${trade.expiration}`;
  if (trade.premium) tradeDesc += ` | Premium $${trade.premium}`;
  if (trade.costAtOpen) tradeDesc += ` | Cost $${trade.costAtOpen}`;
  if (trade.netDebit != null) tradeDesc += ` | Net Debit $${trade.netDebit}`;
  if (trade.maxLoss) tradeDesc += ` | Max Loss $${trade.maxLoss}`;
  if (metrics.stockPrice != null) tradeDesc += ` | Stock Price $${metrics.stockPrice.toFixed(2)}`;
  if (existingOpen > 0) tradeDesc += `\nExisting open ${trade.ticker} positions: ${existingOpen}`;

  return `You are a trade entry advisor. Evaluate this proposed trade.

${heatInfo}
Proposed trade: ${tradeDesc}${historyDesc}

Return ONLY a JSON object (no markdown, no code blocks):
{
  "recommendation": "proceed" | "caution" | "reconsider",
  "headline": "One-sentence assessment with specific numbers",
  "insights": [
    { "label": "<label>", "text": "Specific analysis" }
  ]
}

Use 3-5 insights. Allowed labels: "Risk/Reward", "Sizing", "Ticker History", "Market Context", "Position Fit".

Guidelines:
- "proceed": trade looks reasonable given sizing and portfolio
- "caution": some concerns but not dealbreakers
- "reconsider": significant issues (heat exceeds limit, poor history, over-concentration)
- Be specific with numbers. Be concise.`;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { trade } = body as { trade: TradeInput };

  if (!trade?.ticker) {
    return NextResponse.json({ error: 'Trade data required' }, { status: 400 });
  }

  const dte = calculateDTE(trade.expiration);
  const strategy = trade.strategy?.toUpperCase();
  const optionType = strategy === 'CC' ? 'call' : 'put';

  // Parallel data fetching
  const [data, stockPrice, optionsChain] = await Promise.all([
    gatherPortfolioData(),
    fetchStockPrice(trade.ticker),
    (strategy === 'CSP' || strategy === 'CC')
      ? fetchOptionsChain(trade.ticker, optionType, Math.max(0, dte - 5), dte + 5)
      : Promise.resolve([]),
  ]);

  const tickerHistory = getClosedTradesForTicker(data, trade.ticker);

  // Find matching contract from options chain
  let matchedContract: { delta: number | null; theta: number | null; iv: number | null } | null = null;
  if (optionsChain.length > 0 && trade.strike != null) {
    const match = optionsChain.find(c => c.strike === trade.strike && c.expiration === trade.expiration);
    if (match) {
      matchedContract = { delta: match.delta, theta: match.theta, iv: match.iv };
    } else {
      // Find closest strike
      const closest = optionsChain.reduce((best, c) =>
        Math.abs(c.strike - trade.strike!) < Math.abs(best.strike - trade.strike!) ? c : best
      );
      if (Math.abs(closest.strike - trade.strike) / trade.strike < 0.05) {
        matchedContract = { delta: closest.delta, theta: closest.theta, iv: closest.iv };
      }
    }
  }

  // Compute heat
  const tickerConc = data.tickerConcentration[trade.ticker] || 0;
  const existingOpen = data.openPositions.filter(p => (p.ticker as string) === trade.ticker).length;
  let newCapital = 0;
  if (trade.collateral) newCapital = trade.collateral;
  else if (trade.costAtOpen) newCapital = trade.costAtOpen;
  else if (trade.maxLoss) newCapital = trade.maxLoss;
  const newHeatPercent = data.accountValue > 0
    ? ((data.totalCapitalAtRisk + newCapital) / data.accountValue * 100)
    : 0;

  // Compute metrics
  const metrics = computeMetrics(trade, dte, stockPrice, newHeatPercent, matchedContract);

  // Build history description
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

  const currentHeat = ((data.totalCapitalAtRisk / (data.accountValue || 1)) * 100).toFixed(1);
  const heatInfo = `Account: $${data.accountValue.toLocaleString()} | Current heat: ${currentHeat}% | After trade: ${newHeatPercent.toFixed(1)}% | Max heat: ${data.maxHeatPercent}%\nOpen positions: ${data.openPositions.length} | Total ${trade.ticker} positions: ${tickerConc} (${existingOpen} open)`;

  // Build strategy-specific prompt
  let systemPrompt: string;
  if (strategy === 'CSP') {
    systemPrompt = buildCSPPrompt(trade, metrics, heatInfo, historyDesc, existingOpen);
  } else if (strategy === 'CC') {
    systemPrompt = buildCCPrompt(trade, metrics, heatInfo, historyDesc, existingOpen);
  } else {
    systemPrompt = buildGenericPrompt(trade, metrics, heatInfo, historyDesc, existingOpen);
  }

  const result = await aiCall({
    feature: 'trade-check',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: `Evaluate this ${trade.strategy} trade on ${trade.ticker}.` }],
    maxTokens: 1024,
    ticker: trade.ticker,
  });

  if (!result) {
    return NextResponse.json({ error: 'AI not available' }, { status: 500 });
  }

  try {
    const aiResponse = extractJSON<{ recommendation: TradeCheckResult['recommendation']; headline: string; insights: TradeCheckResult['insights'] }>(result.text);
    const check: TradeCheckResult = {
      recommendation: aiResponse.recommendation,
      headline: aiResponse.headline,
      insights: aiResponse.insights,
      metrics,
    };
    return NextResponse.json(check);
  } catch {
    // Fallback: still return computed metrics even if AI response fails
    const fallback: TradeCheckResult = {
      recommendation: 'caution',
      headline: 'Could not fully analyze — review metrics below.',
      insights: [
        { label: 'Sizing', text: `Heat after trade: ${newHeatPercent.toFixed(1)}% (max ${data.maxHeatPercent}%)` },
        ...(tickerHistory.length > 0 ? [{ label: 'Ticker History', text: `${tickerHistory.length} past trades on ${trade.ticker}` }] : []),
      ],
      metrics,
    };
    return NextResponse.json(fallback);
  }
}
