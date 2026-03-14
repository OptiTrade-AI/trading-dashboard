import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, trackAICall, extractJSON, calculateCost } from '@/lib/ai';
import { gatherPortfolioData, getClosedTradesForTicker } from '@/lib/ai-data';
import { fetchOptionsChain } from '@/lib/polygon';
import { webSearch } from '@/lib/tavily';
import { getHoldingsCollection, getCoveredCallsCollection, getAgentTracesCollection } from '@/lib/collections';
import { calculateCCPL } from '@/lib/utils';
import type { OptimizerAIAnalysis, AggBar, AgentTraceStep, AgentTrace } from '@/types';

// Agent tool definitions for Claude
const agentTools: Anthropic.Tool[] = [
  {
    name: 'get_options_chain',
    description: 'Fetch live call options chain for a ticker from Polygon.io. Returns strikes with Greeks, bid/ask, IV, open interest, and volume.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        minDTE: { type: 'number', description: 'Minimum days to expiration (default 7)' },
        maxDTE: { type: 'number', description: 'Maximum days to expiration (default 60)' },
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
    name: 'get_holdings_data',
    description: 'Get the user\'s holding data for a ticker: cost basis per share, total shares, acquisition dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_cc_history',
    description: 'Get past covered call trades on a specific ticker: premiums collected, strikes used, outcomes, and total historical premium earned.',
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
        query: { type: 'string', description: 'Search query (e.g., "RKLB analyst price target 2026" or "MSTR earnings date Q1 2026")' },
      },
      required: ['query'],
    },
  },
];

const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Execute agent tool calls
async function executeAgentTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = process.env.POLYGON_API_KEY;

  switch (name) {
    case 'get_options_chain': {
      const ticker = input.ticker as string;
      const minDTE = (input.minDTE as number) || 0;
      const maxDTE = (input.maxDTE as number) || 90;
      const chain = await fetchOptionsChain(ticker, 'call', minDTE, maxDTE);
      // Format for the agent — filter to viable strikes, limit to 80
      const formatted = chain
        .filter(c => c.midpoint > 0)
        .sort((a, b) => {
          const expCmp = a.expiration.localeCompare(b.expiration);
          return expCmp !== 0 ? expCmp : a.strike - b.strike;
        })
        .slice(0, 80)
        .map(c => ({
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
        // Fallback
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
        // Compute summary stats
        const closes = bars.map(b => b.c);
        const high52w = Math.max(...closes);
        const low52w = Math.min(...closes);
        const currentPrice = closes[closes.length - 1] || 0;
        // Simple support/resistance from recent highs/lows
        const recent30 = bars.slice(-30);
        const recentHigh = Math.max(...recent30.map(b => b.h));
        const recentLow = Math.min(...recent30.map(b => b.l));
        return {
          ticker,
          days: bars.length,
          currentPrice,
          periodHigh: high52w,
          periodLow: low52w,
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

    case 'get_holdings_data': {
      const ticker = input.ticker as string;
      const col = await getHoldingsCollection();
      const holdings = await col.find({ ticker: { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') } }).toArray();
      if (holdings.length === 0) return { ticker, error: 'No holdings found' };
      const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
      const totalCost = holdings.reduce((s, h) => s + h.shares * h.costBasisPerShare, 0);
      return {
        ticker: ticker.toUpperCase(),
        totalShares,
        costBasisPerShare: +(totalCost / totalShares).toFixed(2),
        totalCostBasis: +totalCost.toFixed(2),
        lots: holdings.map(h => ({
          shares: h.shares,
          costBasisPerShare: h.costBasisPerShare,
          acquiredDate: h.acquiredDate,
        })),
      };
    }

    case 'get_cc_history': {
      const ticker = input.ticker as string;
      const col = await getCoveredCallsCollection();
      const allCCs = await col.find({ ticker: { $regex: new RegExp(`^${escRegex(ticker)}$`, 'i') } }).toArray();
      const openCCs = allCCs.filter(c => c.status === 'open');
      const closedCCs = allCCs.filter(c => c.status !== 'open');
      const totalPremiumEarned = closedCCs.reduce((s, c) => s + calculateCCPL(c), 0);
      return {
        ticker: ticker.toUpperCase(),
        openCalls: openCCs.map(c => ({
          strike: c.strike,
          expiration: c.expiration,
          contracts: c.contracts,
          premiumCollected: c.premiumCollected,
        })),
        closedCalls: closedCCs.slice(-20).map(c => ({
          strike: c.strike,
          expiration: c.expiration,
          contracts: c.contracts,
          premiumCollected: c.premiumCollected,
          exitReason: c.exitReason,
          pl: calculateCCPL(c),
        })),
        totalHistoricalPremium: +totalPremiumEarned.toFixed(2),
        totalClosedTrades: closedCCs.length,
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

const SYSTEM_PROMPT = `You are an expert options strategist specializing in covered call optimization for underwater positions (wheel strategy recovery).

SITUATION: The user has stock positions that were assigned from cash-secured puts. These positions are underwater — the stock price is below their cost basis. They need to sell covered calls below cost basis to collect premium while waiting for recovery.

YOUR TASK: Research the ticker thoroughly using the available tools, then provide a specific covered call recommendation.

RESEARCH PROCESS — BE EFFICIENT:
Call multiple tools simultaneously when possible (e.g., get_holdings_data and get_stock_price together).

1. Get holdings data + stock price simultaneously
2. Get options chain (minDTE 7, maxDTE 60)
3. Web search for analyst price target AND earnings date (2 searches max)
4. Get CC history if useful; get_historical_prices only if needed for support/resistance
5. Produce final JSON output — do NOT continue researching after step 4

ANALYSIS FRAMEWORK:
- Calculate how far underwater the position is (cost basis vs current price)
- Evaluate IV from the options chain — higher IV = richer premiums for selling
- Check earnings date — NEVER recommend selling calls through earnings unless the premium is exceptional
- Consider analyst targets — avoid capping upside below consensus targets when possible
- Target delta 0.20-0.30 for underwater positions (balance income vs recovery potential)
- Assess liquidity: open interest, volume, bid-ask spread width
- Calculate recovery timeline: how many weeks/months of premium collection to close the gap

OUTPUT FORMAT: Return a JSON array with one OptimizerAIAnalysis object:
[
  {
    "ticker": "AAPL",
    "topPick": {
      "symbol": "O:AAPL260417C00150000",
      "strike": 150,
      "expiration": "2026-04-17",
      "reasoning": "2-3 sentences explaining why this specific strike and expiration"
    },
    "alternates": [
      { "strike": 145, "expiration": "2026-04-17", "label": "Higher premium" },
      { "strike": 155, "expiration": "2026-04-17", "label": "Safer strike" }
    ],
    "analystConsensus": "Buy, avg target $180 across 15 analysts",
    "earningsDate": "April 29",
    "ivContext": "IV at 74%, moderately attractive for premium selling",
    "keyRisks": ["Earnings April 29 — avoid selling through", "Strong analyst targets suggest recovery potential"],
    "strategyAdvice": "2-3 sentences of overall strategy advice for this position",
    "recoveryProjection": {
      "weeksEstimate": 12,
      "assumedWeeklyPremium": 1.50,
      "cumulativePremiumNeeded": 18.00
    }
  }
]

IMPORTANT RULES:
- Always use REAL data from tools, never estimate or hallucinate prices/Greeks
- Pick from actual strikes in the options chain
- If a ticker has no options or very thin liquidity, say so clearly
- Be specific about earnings dates and whether they fall within the recommended expiration
- For deeply underwater positions (>40%), focus on pure premium harvesting rather than trying to sell near cost basis`;

// ── Per-ticker agent loop ──
// Runs a focused agent for a single ticker with its own small context.
// Called in parallel for portfolio mode, or once for single-ticker mode.
async function runTickerAnalysis(args: {
  client: Anthropic;
  ticker: string;
  portfolioSummary: string;
  tickerHistory: string;
  send: (event: { type: string; message?: string; data?: unknown }) => void;
  traceStart: number;
  stepCounter: { value: number };
}): Promise<{
  analysis: OptimizerAIAnalysis | null;
  steps: AgentTraceStep[];
  inputTokens: number;
  outputTokens: number;
}> {
  const { client, ticker, portfolioSummary, tickerHistory, send, traceStart, stepCounter } = args;

  const userMessage = `Analyze covered call opportunity for: ${ticker}

${portfolioSummary}
${tickerHistory ? `\nTrade history:\n${tickerHistory}` : ''}

Research this ticker thoroughly using the tools, then return your analysis as JSON.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let inputTokens = 0;
  let outputTokens = 0;
  const steps: AgentTraceStep[] = [];
  const maxIter = 8;
  let analysis: OptimizerAIAnalysis | null = null;

  for (let i = 0; i < maxIter; i++) {
    const iterStart = Date.now();
    const elapsed = Date.now() - traceStart;
    const forceFinish = i >= maxIter - 1 || elapsed > 3 * 60 * 1000;

    // Progress: ticker-specific with running token totals
    send({
      type: 'progress',
      message: forceFinish
        ? `${ticker}: generating analysis...`
        : i === 0
          ? `${ticker}: researching...`
          : `${ticker}: iteration ${i + 1}...`,
      data: { ticker, iteration: i + 1, elapsedMs: elapsed, totalInputTokens: inputTokens, totalOutputTokens: outputTokens },
    });

    // Nudge to finish when approaching limits — append to last user message
    // to avoid consecutive user messages (which the Anthropic API rejects)
    const nudge = forceFinish
      ? 'Produce your final JSON analysis now with the data you have. Do not call more tools.'
      : i >= 5
        ? 'You have enough data. Produce your final JSON analysis now.'
        : null;
    if (nudge) {
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        // Append to existing user message (e.g., tool results)
        if (typeof last.content === 'string') {
          last.content += `\n\n${nudge}`;
        } else {
          // tool_result array — add text block
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

    // Handle text blocks
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
          const parsed = extractJSON<OptimizerAIAnalysis | OptimizerAIAnalysis[]>(text);
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

    // Handle tool use
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUseBlocks.length === 0 && response.stop_reason === 'end_turn') break;

    // Handle max_tokens truncation
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

          const result = await executeAgentTool(toolCall.name, toolInput);

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

  const body = await request.json();
  const { tickers, mode } = body as { tickers: string[]; mode: 'single' | 'portfolio' };

  if (!tickers || tickers.length === 0) {
    return new Response(JSON.stringify({ error: 'tickers required' }), {
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

  // Gather portfolio context for background info
  const portfolioData = await gatherPortfolioData();
  const portfolioSummary = `Portfolio: ${portfolioData.openPositions.length} open positions, ` +
    `$${portfolioData.totalCapitalAtRisk.toFixed(0)} capital at risk, ` +
    `account value $${portfolioData.accountValue.toFixed(0)}, ` +
    `${portfolioData.holdings.length} stock holdings`;

  const tickerList = tickers.map(t => t.toUpperCase());

  // Create SSE stream
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
        const allAnalyses: OptimizerAIAnalysis[] = [];

        if (mode === 'portfolio' && tickerList.length > 1) {
          // ── Portfolio mode: parallel per-ticker agents ──
          send({ type: 'progress', message: `Analyzing ${tickerList.length} tickers in parallel...` });

          const tickerPromises = tickerList.map(async (ticker) => {
            const history = getClosedTradesForTicker(portfolioData, ticker);
            const tickerHistory = history.length > 0
              ? `${ticker}: ${history.length} past trades, total P/L $${history.reduce((s, h) => s + h.pl, 0).toFixed(0)}`
              : '';

            try {
              const result = await runTickerAnalysis({
                client,
                ticker,
                portfolioSummary,
                tickerHistory,
                send,
                traceStart,
                stepCounter,
              });

              // Stream result as soon as this ticker completes
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
          // ── Single ticker mode ──
          const ticker = tickerList[0];
          send({ type: 'progress', message: `Starting analysis of ${ticker}...` });

          const history = getClosedTradesForTicker(portfolioData, ticker);
          const tickerHistory = history.length > 0
            ? `${ticker}: ${history.length} past trades, total P/L $${history.reduce((s, h) => s + h.pl, 0).toFixed(0)}`
            : '';

          const result = await runTickerAnalysis({
            client,
            ticker,
            portfolioSummary,
            tickerHistory,
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

        // Track usage
        await trackAICall('cc-optimizer', 'claude-sonnet-4-6', totalInputTokens, totalOutputTokens, tickerList[0]);

        // Save full trace to MongoDB
        const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const trace: AgentTrace = {
          id: traceId,
          createdAt: new Date().toISOString(),
          tickers: tickerList,
          mode,
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
