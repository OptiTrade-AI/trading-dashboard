import { NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';
import type { SwingSignal } from '@/types';

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();
    const latestRun = await runsCol.findOne(
      { pipelineType: 'SWING_TRADES', status: 'COMPLETED' },
      { sort: { completedAt: -1 } },
    );

    if (!latestRun) {
      return NextResponse.json({ long_signals: [], short_signals: [], timestamp: null });
    }

    const resultsCol = await getPipelineResultsCollection();
    const [longResults, shortResults] = await Promise.all([
      resultsCol.find({ pipelineRunId: latestRun.id, opportunityType: 'swing_long' }, { projection: { _id: 0, data: 1 } }).toArray(),
      resultsCol.find({ pipelineRunId: latestRun.id, opportunityType: 'swing_short' }, { projection: { _id: 0, data: 1 } }).toArray(),
    ]);

    const longSignals: SwingSignal[] = longResults.map((r) => r.data);
    const shortSignals: SwingSignal[] = shortResults.map((r) => r.data);

    return NextResponse.json({
      long_signals: longSignals,
      short_signals: shortSignals,
      timestamp: latestRun.completedAt ?? latestRun.startedAt,
    });
  } catch (error) {
    console.error('Error fetching swing signals:', error);
    return NextResponse.json({ long_signals: [], short_signals: [], timestamp: null }, { status: 500 });
  }
}
