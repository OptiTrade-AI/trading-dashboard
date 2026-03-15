import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, trackAICall, extractJSON, calculateCost } from '@/lib/ai';
import { gatherPortfolioData, getCspTradesForTicker } from '@/lib/ai-data';
import { fetchOptionsChain } from '@/lib/polygon';
import { webSearch } from '@/lib/tavily';
import { getCspTradesCollection, getHoldingsCollection, getCoveredCallsCollection, getSpreadsCollection, getAgentTracesCollection, getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';
import type { CspOptimizerAIAnalysis, AggBar, AgentTraceStep, AgentTrace } from '@/types';

const agentTools: Anthropic.Tool[] = [
  {
    name: 'get_put_options_chain',
    description: 'Fetch live put options chain for a ticker from Polygon.io. Returns strikes with Greeks, bid/ask, IV, open interest, and volume.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        minDTE: { type: 'number', description: 'Minimum days to expiration (default 7)' },
        maxDTE: { type: 'number', description: 'Maximum days to expiration (default 45)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_stock_price',
    description: 'Get current stock price with daily change from Polygon.io snapshot.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_historical_prices',
    description: 'Get daily OHLC price bars for a ticker over the past N days. Useful for identifying support/resistance levels and price trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        days: { type: 'number', description: 'Number of days of history (default 90)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_screener_data',
    description: 'Get the pre-computed pipeline screener data for a ticker: score, Bollinger Band positioning, return on risk, collateral, delta, IV, market cap, sector. This data was computed by the quantitative screening pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_csp_history',
    description: 'Get past cash-secured put trades on a specific ticker: premiums collected, outcomes, assignment history, win rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_portfolio_exposure',
    description: 'Get current portfolio exposure to a ticker: existing CSP positions, stock holdings, covered calls, spreads. Helps assess concentration risk.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for current information about a stock: analyst price targets, earnings dates, recent news, catalysts, and company developments. Use this to get real-time context that market data alone cannot provide.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (e.g., "AAPL analyst price target 2026" or "NVDA earnings date Q2 2026")' },
      },
      required: ['query'],
    },
  },
];

const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function executeAgentTool(
  name: string,
  input: Record<string, unknown>,
  portfolioData: Awaited<ReturnType<typeof gatherPortfolioData>>,
): Promise<unknown> {
  const apiKey = process.env.POLYGON_API_KEY;

  switch (name) {
    case 'get_put_options_chain': {
      const ticker = input.ticker as string;
      const minDTE = (input.minDTE as number) || 7;
      const maxDTE = (input.maxDTE as number) || 45;
      const chain = await fetchOptionsChain(ticker, 'put', minDTE, maxDTE);
      const formatted = chain
        .filter(c => c.midpoint > 0)
        .sort((a, b) => {
          const expCmp = a.expiration.localeCompare(b.expiration);
          return expCmp !== 0 ? expCmp : a.strike - b.strike;
        })
        .slice(0, 80)
        .map(c => ({
          symbol: c.symbol,
          strike: c.strike,
          expiration: c.expiration,
          bid: c.bid,
          ask: c.ask,
          midpoint: +c.midpoint.toFixed(2),
          delta: c.delta !== null ? +c.delta.toFixed(3) : null,
          theta: c.theta !== null ? +c.theta.toFixed(3) : null,
          iv: c.iv !== null ? +(c.iv * 100).toFixed(1) : null,
          openInterest: c.openInterest,
          volume: c.volume,
        }));
      return { ticker, contractCount: formatted.length, contracts: formatted };
    }

    case 'get_stock_price': {
      const ticker = input.ticker as string;
      if (!apiKey) return { error: 'POLYGON_API_KEY not configured' };
      try {
        const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(ticker)}&apiKey=${apiKey}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const t = data.tickers?.[0];
          if (t) {
            const price = t.lastTrade?.p || t.min?.c || t.day?.c || t.prevDay?.c || 0;
            const prevClose = t.prevDay?.c ?? 0;
            return {
              ticker: t.ticker,
              price: +price.toFixed(2),
              change: +(price - prevClose).toFixed(2),
              changePercent: prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0,
            };
          }
        }
        const prevUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;
        const prevRes = await fetch(prevUrl, { cache: 'no-store' });
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          const bar = prevData.results?.[0];
          if (bar) return { ticker, price: bar.c, change: 0, changePercent: 0 };
        }
        return { ticker, error: 'Could not fetch price' };
      } catch {
        return { ticker, error: 'Price fetch failed' };
      }
    }

    case 'get_historical_prices': {
      const ticker = input.ticker as string;
      const days = (input.days as number) || 90;
      if (!apiKey) return { error: 'POLYGON_API_KEY not configured' };
      try {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return { ticker, error: 'Could not fetch historical data' };
        const data = await res.json();
        const bars: AggBar[] = (data.results || []).map((r: Record<string, number>) => ({
          t: r.t, o: +r.o.toFixed(2), h: +r.h.toFixed(2), l: +r.l.toFixed(2), c: +r.c.toFixed(2), v: r.v,
        }));
        if (bars.length === 0) return { ticker, error: 'No historical data available' };
        const closes = bars.map(b => b.c);
        const high = Math.max(...closes);
        const low = Math.min(...closes);
        const currentPrice = closes[closes.length - 1] || 0;
        const recent30 = bars.slice(-30);
        const recentHigh = Math.max(...recent30.map(b => b.h));
        const recentLow = Math.min(...recent30.map(b => b.l));
        return {
          ticker,
          days: bars.length,
          currentPrice,
          periodHigh: high,
          periodLow: low,
          recentHigh30d: +recentHigh.toFixed(2),
          recentLow30d: +recentLow.toFixed(2),
          bars: bars.slice(-20).map(b => ({
            date: new Date(b.t).toISOString().slice(0, 10),
            close: b.c,
            high: b.h,
            low: b.l,
          })),
        };
      } catch {
        return { ticker, error: 'Historical data fetch failed' };
      }
    }

    case 'get_screener_data': {
      const ticker = input.ticker as string;
      try {
        const runsCol = await getPipelineRunsCollection();
        const latestRun = await runsCol.findOne(
          { pipelineType: { $in: ['CSP_SCREENER', 'CSP_ENHANCED' as never] }, status: 'COMPLETED' },
          { sort: { completedAt: -1 } },
        );
        if (!latestRun) return { ticker, error: 'No pipeline data available' };

        const resultsCol = await getPipelineResultsCollection();
        const result = await resultsCol.findOne({
          pipelineRunId: latestRun.id,
          opportunityType: 'csp',
          'data.ticker': { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') },
        });
        if (!result) return { ticker, error: 'Ticker not found in pipeline results' };
        return {
          ticker: ticker.toUpperCase(),
          pipelineRunDate: latestRun.completedAt,
          score: result.score ?? result.data?.score,
          ...result.data,
        };
      } catch {
        return { ticker, error: 'Failed to fetch screener data' };
      }
    }

    case 'get_csp_history': {
      const ticker = input.ticker as string;
      return getCspTradesForTicker(portfolioData, ticker);
    }

    case 'get_portfolio_exposure': {
      const ticker = input.ticker as string;
      const upper = ticker.toUpperCase();
      const openCSPs = portfolioData.allCSPs.filter(t => t.ticker.toUpperCase() === upper && t.status === 'open');
      const openCCs = portfolioData.allCCs.filter(t => t.ticker.toUpperCase() === upper && t.status === 'open');
      const holdings = portfolioData.holdings.filter(h => h.ticker.toUpperCase() === upper);
      const openSpreads = portfolioData.allSpreads.filter(t => t.ticker.toUpperCase() === upper && t.status === 'open');
      const totalCollateralAtRisk = openCSPs.reduce((s, t) => s + t.collateral, 0);
      return {
        ticker: upper,
        hasExposure: openCSPs.length > 0 || openCCs.length > 0 || holdings.length > 0 || openSpreads.length > 0,
        openCSPs: openCSPs.map(t => ({ strike: t.strike, expiration: t.expiration, contracts: t.contracts, collateral: t.collateral })),
        openCCs: openCCs.map(t => ({ strike: t.strike, expiration: t.expiration, contracts: t.contracts })),
        holdings: holdings.map(h => ({ shares: h.shares, costBasisPerShare: h.costBasisPerShare })),
        openSpreads: openSpreads.map(s => ({ type: s.spreadType, longStrike: s.longStrike, shortStrike: s.shortStrike, contracts: s.contracts })),
        totalCollateralAtRisk,
        accountValue: portfolioData.accountValue,
        currentHeatPercent: portfolioData.accountValue > 0
          ? +(portfolioData.totalCapitalAtRisk / portfolioData.accountValue * 100).toFixed(1)
          : 0,
        maxHeatPercent: portfolioData.maxHeatPercent,
      };
    }

    case 'web_search': {
      const query = input.query as string;
      const results = await webSearch(query, 5);
      return {
        query,
        results: results.map(r => ({
          title: r.title,
          content: r.content.slice(0, 500),
          url: r.url,
        })),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = `You are an expert options strategist specializing in cash-secured put selling for premium income and stock acquisition at a discount.

SITUATION: The user is reviewing opportunities from a quantitative screener that has already filtered ~3,000 stocks down to the best CSP candidates based on Bollinger Bands positioning, IV, delta, return on risk, liquidity, and market cap. Your job is to add qualitative AI analysis on top of the quantitative data.

YOUR TASK: Research each ticker, assess whether it's a good CSP candidate RIGHT NOW, and present 3 strategy lanes so the user can choose their risk level.

RESEARCH PROCESS — BE EFFICIENT:
Call multiple tools simultaneously when possible.

1. Get screener data + stock price simultaneously
2. Get put options chain (minDTE 7, maxDTE 45) + get historical prices simultaneously
3. Web search for catalysts: earnings date, FDA dates, analyst targets, recent news (2-3 searches)
4. Get CSP history + portfolio exposure if useful
5. Produce final JSON output — do NOT continue researching after step 4

CRITICAL CONTEXT TO RESEARCH:
- Earnings date — NEVER recommend selling puts THROUGH earnings unless premium compensates for the binary event risk
- Analyst consensus and price targets — the strike should ideally be below the lowest analyst target
- Recent news — any M&A, FDA, product launches that could cause big moves
- Bollinger Band position — the screener already filtered for this, but interpret what it means for timing

ANALYSIS FRAMEWORK:
- The screener has already done quantitative filtering. Your value-add is QUALITATIVE judgment
- Ask: "Would I want to own 100 shares of this stock at the effective cost basis (strike - premium)?"
- Assess company quality: is this a stock worth owning if assigned?
- Check if IV is elevated due to a specific event (earnings, FDA) vs structural high IV
- Evaluate liquidity from the options chain: OI, volume, bid-ask spread width
- Consider portfolio concentration: does the user already have exposure to this ticker?

CSP STRATEGY LANES — present 3 options:
1. "Conservative" (mode: "conservative"): Lowest delta put in the -0.15 to -0.20 range. Highest POP, lowest premium. Best for quality companies you'd gladly own. Focus on 30+ DTE for time value.
2. "Balanced" (mode: "balanced"): Mid-range delta -0.20 to -0.30. Good balance of premium income and safety. This is usually the recommended pick. Prefer 21-35 DTE sweet spot for theta decay.
3. "Aggressive" (mode: "aggressive"): Higher delta -0.30 to -0.40. Maximum premium, but real assignment risk. Only recommend for stocks the user would genuinely want to own. Prefer shorter DTE (14-21 days) to limit catalyst exposure.

FOR EACH PICK, CALCULATE:
- premium: use bid price (conservative fill estimate)
- collateral: strike * 100
- returnOnRisk: (premium / (strike - premium)) * 100
- annualizedROR: returnOnRisk * (365 / DTE)
- probabilityOfProfit: (1 + delta) * 100  (delta is negative for puts)
- breakEven: strike - premium
- discountFromCurrent: ((currentPrice - breakEven) / currentPrice) * 100

OUTPUT FORMAT: Return a JSON object for this ticker.
Always populate numeric fields from actual chain data. Keep "reasoning" to 2 concise sentences.

{
  "ticker": "AAPL",
  "stockPrice": 178.50,
  "strategies": [
    {
      "mode": "conservative",
      "label": "Conservative",
      "viable": true,
      "pick": {
        "symbol": "O:AAPL260410P00165000",
        "strike": 165,
        "expiration": "2026-04-10",
        "reasoning": "Far OTM put below all analyst targets with strong liquidity",
        "premium": 1.25, "delta": -0.18, "openInterest": 5200, "volume": 1800,
        "collateral": 16500, "returnOnRisk": 0.76, "annualizedROR": 11.5,
        "probabilityOfProfit": 82, "breakEven": 163.75, "discountFromCurrent": 8.3,
        "iv": 28.5
      }
    },
    {
      "mode": "balanced",
      "label": "Balanced",
      "viable": true,
      "recommended": true,
      "pick": { "symbol": "...", "strike": 170, "expiration": "2026-04-10", "reasoning": "...", "premium": 2.15, "delta": -0.25, "openInterest": 8400, "volume": 3200, "collateral": 17000, "returnOnRisk": 1.27, "annualizedROR": 19.2, "probabilityOfProfit": 75, "breakEven": 167.85, "discountFromCurrent": 5.97, "iv": 30.1 }
    },
    {
      "mode": "aggressive",
      "label": "Aggressive",
      "viable": true,
      "pick": { "symbol": "...", "strike": 175, "expiration": "2026-03-27", "reasoning": "...", "premium": 3.80, "delta": -0.35, "openInterest": 12000, "volume": 5500, "collateral": 17500, "returnOnRisk": 2.22, "annualizedROR": 67.4, "probabilityOfProfit": 65, "breakEven": 171.20, "discountFromCurrent": 4.09, "iv": 32.4 }
    }
  ],
  "catalysts": ["Earnings April 25 — all picks expire before this", "New iPhone launch expected June"],
  "analystConsensus": "Buy, avg target $210, lowest target $185",
  "earningsDate": "April 25",
  "ivContext": "IV at 28% is below 30-day average of 32% — premiums are fair but not rich",
  "bollingerContext": "Stock trading 3% above lower BB — showing support at $172 level",
  "sectorContext": "Technology sector, mega-cap. Low single-stock risk.",
  "whyThisTrade": "AAPL is a high-quality mega-cap trading near BB support with upcoming product catalysts. Assignment at $163.75 effective cost basis would be an excellent long-term entry.",
  "keyRisks": ["Tariff escalation could pressure consumer electronics", "iPhone cycle uncertainty"],
  "assignmentScenario": {
    "effectiveCostBasis": 163.75,
    "currentDiscount": 8.3,
    "qualityAssessment": "World-class business with $100B+ annual buybacks. Would be thrilled to own at this price.",
    "ccOpportunity": "If assigned, could sell $175 calls for ~$3.50/share monthly income"
  },
  "positionSizing": {
    "suggestedContracts": 2,
    "capitalRequired": 33000,
    "portfolioHeatImpact": 6.6,
    "maxContracts": 5
  }
}

IMPORTANT RULES:
- Always use REAL data from tools, never estimate or hallucinate prices/Greeks
- Pick from actual strikes in the put options chain — use the symbol field from the chain data
- If a ticker has no puts or very thin liquidity, say so clearly and set viable=false
- Always include the catalysts array — this is required for every analysis
- Be specific about earnings dates and whether they fall within each recommended expiration
- The assignmentScenario is REQUIRED — this is what differentiates CSP analysis from generic options screening
- For positionSizing, use the portfolio context (account value, current heat) from get_portfolio_exposure to make realistic suggestions
- If get_screener_data returns data, reference its score and BB positioning in your bollingerContext`;

async function runTickerAnalysis(args: {
  client: Anthropic;
  ticker: string;
  portfolioSummary: string;
  portfolioData: Awaited<ReturnType<typeof gatherPortfolioData>>;
  send: (event: { type: string; message?: string; data?: unknown }) => void;
  traceStart: number;
  stepCounter: { value: number };
}): Promise<{
  analysis: CspOptimizerAIAnalysis | null;
  steps: AgentTraceStep[];
  inputTokens: number;
  outputTokens: number;
}> {
  const { client, ticker, portfolioSummary, portfolioData, send, traceStart, stepCounter } = args;

  const cspHistory = getCspTradesForTicker(portfolioData, ticker);
  const historyText = cspHistory.totalClosedTrades > 0
    ? `\nCSP History on ${ticker}: ${cspHistory.totalClosedTrades} past trades, $${cspHistory.totalPremiumEarned} total premium, ${cspHistory.winRate}% win rate, assigned ${cspHistory.timesAssigned} times`
    : '';

  const userMessage = `Analyze cash-secured put opportunity for: ${ticker}

${portfolioSummary}${historyText}

Research this ticker thoroughly using the tools, then return your analysis as JSON.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let inputTokens = 0;
  let outputTokens = 0;
  const steps: AgentTraceStep[] = [];
  const maxIter = 8;
  let analysis: CspOptimizerAIAnalysis | null = null;

  for (let i = 0; i < maxIter; i++) {
    const iterStart = Date.now();
    const elapsed = Date.now() - traceStart;
    const forceFinish = i >= maxIter - 1 || elapsed > 3 * 60 * 1000;

    send({
      type: 'progress',
      message: forceFinish
        ? `${ticker}: generating analysis...`
        : i === 0
          ? `${ticker}: researching...`
          : `${ticker}: iteration ${i + 1}...`,
      data: { ticker, iteration: i + 1, elapsedMs: elapsed, totalInputTokens: inputTokens, totalOutputTokens: outputTokens },
    });

    const nudge = forceFinish
      ? 'Produce your final JSON analysis now with the data you have. Do not call more tools.'
      : i >= 5
        ? 'You have enough data. Produce your final JSON analysis now.'
        : null;
    if (nudge) {
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        if (typeof last.content === 'string') {
          last.content += `\n\n${nudge}`;
        } else {
          (last.content as Anthropic.ToolResultBlockParam[]).push({ type: 'text', text: nudge } as unknown as Anthropic.ToolResultBlockParam);
        }
      } else {
        messages.push({ role: 'user', content: nudge });
      }
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: forceFinish ? undefined : agentTools,
      messages,
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    if (textBlocks.length > 0) {
      const text = textBlocks.map(b => b.text).join('');
      steps.push({
        stepIndex: stepCounter.value++,
        timestamp: new Date().toISOString(),
        type: 'thinking',
        thinking: text,
        durationMs: Date.now() - iterStart,
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      });
      send({ type: 'trace_step', data: steps[steps.length - 1] });

      if (response.stop_reason === 'end_turn') {
        try {
          const parsed = extractJSON<CspOptimizerAIAnalysis | CspOptimizerAIAnalysis[]>(text);
          analysis = Array.isArray(parsed) ? parsed[0] : parsed;
          if (analysis && !analysis.ticker) analysis.ticker = ticker;
          steps.push({
            stepIndex: stepCounter.value++,
            timestamp: new Date().toISOString(),
            type: 'final_answer',
            thinking: `${ticker}: analysis complete`,
          });
          send({ type: 'trace_step', data: steps[steps.length - 1] });
        } catch {
          steps.push({
            stepIndex: stepCounter.value++,
            timestamp: new Date().toISOString(),
            type: 'final_answer',
            thinking: `${ticker}: could not parse analysis JSON`,
          });
          send({ type: 'trace_step', data: steps[steps.length - 1] });
        }
        break;
      }
    }

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUseBlocks.length === 0 && response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'max_tokens' && toolUseBlocks.length === 0) {
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: 'Your response was truncated. Continue from where you left off and complete the JSON.' });
      continue;
    }

    if (toolUseBlocks.length > 0) {
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolCall) => {
          const toolInput = toolCall.input as Record<string, unknown>;
          const toolStart = Date.now();

          const callStep: AgentTraceStep = {
            stepIndex: stepCounter.value++,
            timestamp: new Date().toISOString(),
            type: 'tool_call',
            toolName: toolCall.name,
            toolInput,
          };
          steps.push(callStep);
          send({ type: 'trace_step', data: callStep });

          const label = (toolInput.ticker || toolInput.query || '') as string;
          send({ type: 'progress', message: `${ticker}: ${toolCall.name}${label ? ` ${label}` : ''}`, data: { ticker, elapsedMs: Date.now() - traceStart } });

          const result = await executeAgentTool(toolCall.name, toolInput, portfolioData);

          const resultStep: AgentTraceStep = {
            stepIndex: stepCounter.value++,
            timestamp: new Date().toISOString(),
            type: 'tool_result',
            toolName: toolCall.name,
            toolResult: result,
            durationMs: Date.now() - toolStart,
          };
          steps.push(resultStep);
          send({ type: 'trace_step', data: resultStep });

          return {
            type: 'tool_result' as const,
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          };
        }),
      );

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  return { analysis, steps, inputTokens, outputTokens };
}

export async function POST(request: NextRequest) {
  const client = getAnthropicClient();
  if (!client) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { tickers?: unknown; mode?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tickers: rawTickers, mode } = body as { tickers?: unknown; mode?: 'single' | 'batch' };

  if (!Array.isArray(rawTickers) || rawTickers.length === 0) {
    return new Response(JSON.stringify({ error: 'tickers required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tickers = rawTickers.filter((t): t is string => typeof t === 'string' && /^[A-Z]{1,10}$/i.test(t));
  if (tickers.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid tickers provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (tickers.length > 20) {
    return new Response(JSON.stringify({ error: 'Maximum 20 tickers allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const portfolioData = await gatherPortfolioData();
  const portfolioSummary = `Portfolio: ${portfolioData.openPositions.length} open positions, ` +
    `$${portfolioData.totalCapitalAtRisk.toFixed(0)} capital at risk, ` +
    `account value $${portfolioData.accountValue.toFixed(0)}, ` +
    `max heat ${portfolioData.maxHeatPercent}%, ` +
    `current heat ${portfolioData.accountValue > 0 ? (portfolioData.totalCapitalAtRisk / portfolioData.accountValue * 100).toFixed(1) : 0}%`;

  const tickerList = tickers.map(t => t.toUpperCase());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; message?: string; data?: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const traceStart = Date.now();
        const stepCounter = { value: 0 };
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const allSteps: AgentTraceStep[] = [];
        const allAnalyses: CspOptimizerAIAnalysis[] = [];

        if (mode === 'batch' && tickerList.length > 1) {
          send({ type: 'progress', message: `Analyzing ${tickerList.length} tickers in parallel...` });

          const tickerPromises = tickerList.map(async (ticker) => {
            try {
              const result = await runTickerAnalysis({
                client,
                ticker,
                portfolioSummary,
                portfolioData,
                send,
                traceStart,
                stepCounter,
              });

              if (result.analysis) {
                send({ type: 'analysis', data: result.analysis });
                send({ type: 'progress', message: `${ticker}: done`, data: { ticker, elapsedMs: Date.now() - traceStart } });
              }

              return result;
            } catch (err) {
              send({ type: 'progress', message: `${ticker}: failed — ${err instanceof Error ? err.message : 'unknown error'}` });
              return { analysis: null, steps: [] as AgentTraceStep[], inputTokens: 0, outputTokens: 0 };
            }
          });

          const results = await Promise.allSettled(tickerPromises);
          for (const r of results) {
            if (r.status === 'fulfilled') {
              allSteps.push(...r.value.steps);
              totalInputTokens += r.value.inputTokens;
              totalOutputTokens += r.value.outputTokens;
              if (r.value.analysis) allAnalyses.push(r.value.analysis);
            }
          }
        } else {
          const ticker = tickerList[0];
          send({ type: 'progress', message: `Starting analysis of ${ticker}...` });

          const result = await runTickerAnalysis({
            client,
            ticker,
            portfolioSummary,
            portfolioData,
            send,
            traceStart,
            stepCounter,
          });

          allSteps.push(...result.steps);
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;

          if (result.analysis) {
            allAnalyses.push(result.analysis);
            send({ type: 'analysis', data: result.analysis });
          }
        }

        await trackAICall('csp-optimizer', 'claude-sonnet-4-6', totalInputTokens, totalOutputTokens, tickerList[0]);

        const traceId = `csp_trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const trace: AgentTrace = {
          id: traceId,
          feature: 'csp-optimizer',
          createdAt: new Date().toISOString(),
          tickers: tickerList,
          mode: mode === 'batch' ? 'portfolio' : 'single',
          steps: allSteps.sort((a, b) => a.stepIndex - b.stepIndex),
          totalDurationMs: Date.now() - traceStart,
          totalInputTokens,
          totalOutputTokens,
          costUsd: calculateCost('claude-sonnet-4-6', totalInputTokens, totalOutputTokens),
          result: allAnalyses.length > 0 ? allAnalyses : undefined,
        };

        try {
          const col = await getAgentTracesCollection();
          await col.insertOne(trace);
        } catch {
          // Don't fail if trace save fails
        }

        send({ type: 'trace_complete', data: { traceId, totalSteps: allSteps.length, durationMs: trace.totalDurationMs, costUsd: trace.costUsd } });
        send({ type: 'done', message: 'Analysis complete' });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Analysis failed' });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
