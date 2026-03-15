import { NextRequest, NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';

export interface ScoreHistoryEntry {
  date: string;
  score: number;
}

export interface TickerScoreHistory {
  scores: ScoreHistoryEntry[];
  trend: 'up' | 'down' | 'stable' | 'new';
}

export async function GET(request: NextRequest) {
  try {
    const tickersParam = request.nextUrl.searchParams.get('tickers');
    if (!tickersParam) {
      return NextResponse.json({});
    }

    const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 50);
    if (tickers.length === 0) {
      return NextResponse.json({});
    }

    const runsCol = await getPipelineRunsCollection();
    const resultsCol = await getPipelineResultsCollection();

    // Get last 10 completed CSP_ENHANCED runs
    const recentRuns = await runsCol
      .find(
        { pipelineType: 'CSP_ENHANCED', status: 'COMPLETED' },
        { sort: { completedAt: -1 }, limit: 10, projection: { id: 1, completedAt: 1 } },
      )
      .toArray();

    if (recentRuns.length === 0) {
      return NextResponse.json({});
    }

    // Filter out runs without completedAt
    const validRuns = recentRuns.filter(r => r.completedAt);
    if (validRuns.length === 0) {
      return NextResponse.json({});
    }

    const runIds = validRuns.map(r => r.id);
    const runDateMap = new Map(validRuns.map(r => [r.id, r.completedAt as string]));

    // Fetch all results for these runs and requested tickers
    const results = await resultsCol
      .find(
        {
          pipelineRunId: { $in: runIds },
          opportunityType: 'csp',
          'data.ticker': { $in: tickers },
        },
        { projection: { _id: 0, pipelineRunId: 1, 'data.ticker': 1, score: 1, 'data.score': 1 } },
      )
      .toArray();

    // Group by ticker
    const tickerHistory: Record<string, TickerScoreHistory> = {};

    for (const ticker of tickers) {
      const tickerResults = results
        .filter(r => r.data?.ticker === ticker)
        .map(r => ({
          date: runDateMap.get(r.pipelineRunId) || '',
          score: r.score ?? r.data?.score ?? 0,
          runId: r.pipelineRunId,
        }))
        // Sort by run order (oldest first)
        .sort((a, b) => {
          const aIdx = runIds.indexOf(a.runId);
          const bIdx = runIds.indexOf(b.runId);
          return bIdx - aIdx; // runIds is newest-first, reverse for chronological
        });

      if (tickerResults.length === 0) continue;

      const scores: ScoreHistoryEntry[] = tickerResults.map(r => ({
        date: r.date,
        score: r.score,
      }));

      // Calculate trend
      let trend: 'up' | 'down' | 'stable' | 'new' = 'new';
      if (scores.length > 1) {
        const latest = scores[scores.length - 1].score;
        const previous = scores.slice(0, -1).slice(-3); // last 3 before current
        const avgPrev = previous.reduce((s, p) => s + p.score, 0) / previous.length;

        if (latest > avgPrev * 1.1) trend = 'up';
        else if (latest < avgPrev * 0.9) trend = 'down';
        else trend = 'stable';
      }

      tickerHistory[ticker] = { scores, trend };
    }

    return NextResponse.json(tickerHistory);
  } catch (error) {
    console.error('Error fetching CSP score history:', error);
    return NextResponse.json({}, { status: 500 });
  }
}
