import { NextRequest, NextResponse } from 'next/server';
import { aiCall, extractJSON } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import { getPatternAnalysesCollection } from '@/lib/collections';
import { calculatePL, calculateCCPL, calculateDirectionalPL, calculateSpreadPL, calculateDaysHeld } from '@/lib/utils';
import { subDays, subMonths, startOfYear, parseISO, isAfter, format } from 'date-fns';
import type { BehavioralFinding, PatternLens } from '@/types';
import crypto from 'crypto';

export async function GET() {
  const col = await getPatternAnalysesCollection();
  const history = await col.find({}).sort({ timestamp: -1 }).limit(20).toArray();
  return NextResponse.json({ history });
}

// Raw trade row sent to AI
interface TradeRow {
  strategy: string;
  ticker: string;
  strike: number;
  contracts: number;
  pl: number;
  plPercent: number;
  daysHeld: number;
  dteAtEntry: number;
  exitReason: string;
  entryDate: string;
  exitDate: string;
  entryMonth: string;
  dayOfWeek: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTimeRangeCutoff(timeRange: string): Date | null {
  const now = new Date();
  switch (timeRange) {
    case '1W': return subDays(now, 7);
    case '1M': return subMonths(now, 1);
    case '3M': return subMonths(now, 3);
    case '6M': return subMonths(now, 6);
    case 'YTD': return startOfYear(now);
    default: return null;
  }
}

function computeFingerprint(trades: TradeRow[]): string {
  const key = trades.map(t => `${t.ticker}:${t.exitDate}:${t.pl.toFixed(0)}`).sort().join('|');
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 12);
}

const LENS_CONFIG: Record<PatternLens, { label: string; progressMsg: string; questions: string }> = {
  timing: {
    label: 'Timing & Entry Discipline',
    progressMsg: 'Analyzing entry timing patterns...',
    questions: `Analyze TIMING and ENTRY DISCIPLINE:

1. **Post-loss behavior**: Look at trades entered within 1-3 days after a losing trade closed. Are those follow-up trades worse (lower win rate, bigger losses)? This reveals revenge trading or tilt.
2. **DTE sweet spot mismatch**: Where does win rate peak by DTE bucket vs where this trader enters most trades? Is there a mismatch where they trade most at non-optimal DTE ranges?
3. **Day-of-week clustering**: Are entries clustered on certain days? Do specific days have worse outcomes (e.g., Monday entries underperform)?
4. **Position sizing after wins vs losses**: Do contracts increase after winning streaks (overconfidence) or after losses (doubling down)?
5. **Trade frequency trends**: Is trading frequency accelerating or decelerating over the time window? Does higher frequency correlate with worse outcomes?

Focus on the most impactful finding(s). Skip anything that lacks statistical evidence in the data.`,
  },
  exit: {
    label: 'Exit Execution',
    progressMsg: 'Analyzing exit discipline...',
    questions: `Analyze EXIT EXECUTION:

1. **Holding losers too long**: Compare average hold time for winners vs losers, broken down by strategy. Are losers held significantly longer (a classic bias)?
2. **Exit reason effectiveness**: Which exit reasons (50% profit, time stop, assigned, etc.) produce the best avg P/L per trade? Are under-used exit reasons actually the most profitable?
3. **50% profit rule compliance**: For premium-selling strategies (CSP, CC), what % of trades are closed near 50% of max profit? Do trades held past 50% tend to give back gains?
4. **Worst exits**: Identify specific trades with high DTE at entry, long hold time, and a loss — these likely gave back unrealized profit. Are there patterns in which tickers or strategies this happens?
5. **Strategy-specific exit differences**: Do exit patterns differ between CSP and CC? Is one managed more disciplined than the other?

Focus on the most impactful finding(s). Skip anything that lacks statistical evidence in the data.`,
  },
  strategy: {
    label: 'Strategy & Ticker Selection',
    progressMsg: 'Analyzing strategy and ticker patterns...',
    questions: `Analyze STRATEGY and TICKER SELECTION:

1. **Strategy effectiveness**: Which strategies (CSP, CC, Directional, Spread) are actually profitable vs which keep getting traded despite poor results? Compare win rate and avg P/L per strategy.
2. **Ticker affinity**: Identify "conviction tickers" (traded 3+ times, high win rate) vs "lottery tickers" (1-2 trades, poor results). Is there over-diversification or under-diversification?
3. **Concentration risk**: Are losses concentrated in a few tickers or a specific time period? Is there a "blowup" pattern where one bad ticker wipes out gains from many good trades?
4. **Strategy drift**: Has the strategy mix changed between the first half and second half of the time window? Is the drift toward better or worse strategies?
5. **Size discipline**: Do larger positions (more contracts) perform worse? Is there a correlation between position size and loss magnitude?

Focus on the most impactful finding(s). Skip anything that lacks statistical evidence in the data.`,
  },
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const timeRange: string = body.timeRange || 'ALL';
  const force: boolean = !!body.force;

  const data = await gatherPortfolioData(12);

  // Build raw trade list
  const allTrades: TradeRow[] = [];

  for (const t of data.allCSPs.filter(t => t.status === 'closed' && t.exitDate)) {
    const pl = calculatePL(t);
    const exitD = parseISO(t.exitDate!);
    allTrades.push({
      strategy: 'CSP', ticker: t.ticker, strike: t.strike, contracts: t.contracts, pl,
      plPercent: t.collateral > 0 ? +(pl / t.collateral * 100).toFixed(1) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown',
      entryDate: t.entryDate, exitDate: t.exitDate!,
      entryMonth: format(parseISO(t.entryDate), 'yyyy-MM'),
      dayOfWeek: DAYS_OF_WEEK[parseISO(t.entryDate).getDay()],
    });
  }
  for (const t of data.allCCs.filter(t => t.status !== 'open' && t.exitDate)) {
    const pl = calculateCCPL(t);
    allTrades.push({
      strategy: 'CC', ticker: t.ticker, strike: t.strike, contracts: t.contracts, pl,
      plPercent: t.costBasis > 0 ? +(pl / t.costBasis * 100).toFixed(1) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown',
      entryDate: t.entryDate, exitDate: t.exitDate!,
      entryMonth: format(parseISO(t.entryDate), 'yyyy-MM'),
      dayOfWeek: DAYS_OF_WEEK[parseISO(t.entryDate).getDay()],
    });
  }
  for (const t of data.allDir.filter(t => t.status === 'closed' && t.exitDate)) {
    const pl = calculateDirectionalPL(t);
    allTrades.push({
      strategy: 'Directional', ticker: t.ticker, strike: t.strike, contracts: t.contracts, pl,
      plPercent: t.costAtOpen > 0 ? +(pl / t.costAtOpen * 100).toFixed(1) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown',
      entryDate: t.entryDate, exitDate: t.exitDate!,
      entryMonth: format(parseISO(t.entryDate), 'yyyy-MM'),
      dayOfWeek: DAYS_OF_WEEK[parseISO(t.entryDate).getDay()],
    });
  }
  for (const t of data.allSpreads.filter(t => t.status === 'closed' && t.exitDate)) {
    const pl = calculateSpreadPL(t);
    const base = t.netDebit < 0 ? t.maxLoss : t.netDebit;
    allTrades.push({
      strategy: 'Spread', ticker: t.ticker, strike: t.longStrike, contracts: t.contracts, pl,
      plPercent: base > 0 ? +(pl / base * 100).toFixed(1) : 0,
      daysHeld: calculateDaysHeld(t), dteAtEntry: t.dteAtEntry,
      exitReason: t.exitReason || 'unknown',
      entryDate: t.entryDate, exitDate: t.exitDate!,
      entryMonth: format(parseISO(t.entryDate), 'yyyy-MM'),
      dayOfWeek: DAYS_OF_WEEK[parseISO(t.entryDate).getDay()],
    });
  }

  // Apply time range filter
  const cutoff = getTimeRangeCutoff(timeRange);
  const filtered = cutoff
    ? allTrades.filter(t => isAfter(parseISO(t.exitDate), cutoff))
    : allTrades;

  if (filtered.length < 5) {
    return NextResponse.json({
      findings: [{
        id: '1', lens: 'timing' as PatternLens, title: 'Insufficient Data',
        description: `Only ${filtered.length} closed trades in the ${timeRange} range. Need at least 5 for pattern analysis.`,
        severity: 'neutral' as const, trend: 'stable' as const,
        metric: `${filtered.length} trades`, actionItem: 'Close more trades or expand the time range.',
      }],
    });
  }

  // Sort chronologically and cap at 300
  filtered.sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  const trades = filtered.slice(-300);

  // Compute fingerprint
  const fingerprint = computeFingerprint(trades);

  // Check for duplicate analysis
  const col = await getPatternAnalysesCollection();
  const lastAnalysis = await col.find({}).sort({ timestamp: -1 }).limit(1).toArray();
  if (!force && lastAnalysis.length > 0 && lastAnalysis[0].tradeFingerprint === fingerprint && lastAnalysis[0].timeRange === timeRange) {
    return NextResponse.json({ noNewTrades: true, lastAnalysis: lastAnalysis[0] });
  }

  // Get previous findings for dedup
  const previousFindings: BehavioralFinding[] = lastAnalysis[0]?.findings || [];
  const previousPatternsText = previousFindings.length > 0
    ? previousFindings.map(f => `- "${f.title}": ${f.description}`).join('\n')
    : lastAnalysis[0]?.patterns?.map((p: { title: string; description: string }) => `- "${p.title}": ${p.description}`).join('\n') || '';

  // Portfolio context
  const totalPL = trades.reduce((s, t) => s + t.pl, 0);
  const totalWins = trades.filter(t => t.pl > 0).length;
  const winRate = totalWins / trades.length;
  const strategyMix: Record<string, number> = {};
  for (const t of trades) {
    strategyMix[t.strategy] = (strategyMix[t.strategy] || 0) + 1;
  }
  const strategyMixStr = Object.entries(strategyMix)
    .map(([s, c]) => `${s}: ${c} trades (${(c / trades.length * 100).toFixed(0)}%)`)
    .join(', ');

  const portfolioContext = `PORTFOLIO CONTEXT:
Account value: $${data.accountValue.toFixed(0)}
Open positions: ${data.openPositions.length}
Strategy mix: ${strategyMixStr}
Overall: ${totalWins}W/${trades.length - totalWins}L (${(winRate * 100).toFixed(1)}% win rate), $${totalPL.toFixed(0)} total P/L`;

  const dedupBlock = previousPatternsText
    ? `\nPREVIOUS FINDINGS (DO NOT REPEAT — only report if they've CHANGED or REVERSED):\n${previousPatternsText}\nIf a previous finding has changed, reversed, or is no longer true, that IS a valid new finding.`
    : '';

  // SSE streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; [key: string]: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const allFindings: BehavioralFinding[] = [];
        const lenses: PatternLens[] = ['timing', 'exit', 'strategy'];
        let findingCounter = 0;

        for (const lens of lenses) {
          const config = LENS_CONFIG[lens];
          send({ type: 'progress', lens, message: config.progressMsg });

          const systemPrompt = `You are a behavioral trading analyst examining an options trader's complete trade history. Focus EXCLUSIVELY on ${config.label}.

TRADE DATA (${trades.length} closed trades, ${timeRange} range):
${JSON.stringify(trades)}

${portfolioContext}
${dedupBlock}

${config.questions}

Return ONLY a JSON array of 1-3 findings (no markdown, no code blocks):
[
  {
    "title": "<5-10 word pattern name>",
    "description": "<2-4 sentences with SPECIFIC numbers from the data — cite actual win rates, P/L amounts, trade counts>",
    "severity": "positive" | "negative" | "neutral",
    "trend": "improving" | "worsening" | "stable" | "new",
    "metric": "<key stat, e.g. '72% win rate under 21 DTE' or '-$840 from 3 revenge trades'>",
    "actionItem": "<one specific, concrete recommendation — not generic advice>",
    "evidenceTrades": ["<ticker $strike strategy exitDate → P/L>", "<another trade>"]
  }
]

Rules:
- Every finding MUST cite specific numbers from the trade data
- evidenceTrades must reference REAL trades from the data (ticker, strike, date, P/L)
- actionItem must be specific enough to act on immediately (not "be more disciplined")
- Skip any analysis area where the data doesn't support a clear pattern
- Return fewer findings rather than weak ones — quality over quantity`;

          try {
            const result = await aiCall({
              feature: 'patterns',
              model: 'claude-sonnet-4-6',
              system: systemPrompt,
              messages: [{ role: 'user', content: `Analyze my ${config.label.toLowerCase()} patterns.` }],
              maxTokens: 2048,
            });

            if (result) {
              const lensFindings = extractJSON<Array<Omit<BehavioralFinding, 'id' | 'lens'>>>(result.text);
              if (lensFindings && Array.isArray(lensFindings)) {
                for (const f of lensFindings) {
                  findingCounter++;
                  const finding: BehavioralFinding = {
                    ...f,
                    id: String(findingCounter),
                    lens,
                  };
                  allFindings.push(finding);
                  send({ type: 'finding', data: finding });
                }
              }
            }
          } catch (err) {
            send({ type: 'error', message: `${config.label} analysis failed: ${err instanceof Error ? err.message : 'unknown'}` });
          }

          send({ type: 'lens_complete', lens });
        }

        // Save to MongoDB
        const record = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          findings: allFindings,
          tradeCount: trades.length,
          totalPL: Math.round(totalPL * 100) / 100,
          winRate: Math.round(winRate * 1000) / 10,
          timeRange,
          tradeFingerprint: fingerprint,
        };
        await col.insertOne(record);

        send({ type: 'done', record });
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
