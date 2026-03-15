import { NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();
    const latestRun = await runsCol.findOne(
      { pipelineType: 'AGGRESSIVE_OPTIONS', status: 'COMPLETED' },
      { sort: { completedAt: -1 } },
    );

    if (!latestRun) {
      return NextResponse.json({ calls: [], puts: [], ticker_changes: { calls: null, puts: null } });
    }

    const resultsCol = await getPipelineResultsCollection();
    const [calls, puts, callChanges, putChanges] = await Promise.all([
      resultsCol.find({ pipelineRunId: latestRun.id, opportunityType: 'aggressive_call' }, { projection: { _id: 0, data: 1 } }).toArray(),
      resultsCol.find({ pipelineRunId: latestRun.id, opportunityType: 'aggressive_put' }, { projection: { _id: 0, data: 1 } }).toArray(),
      resultsCol.findOne({ pipelineRunId: latestRun.id, opportunityType: 'call_changes' }, { projection: { _id: 0, data: 1 } }),
      resultsCol.findOne({ pipelineRunId: latestRun.id, opportunityType: 'put_changes' }, { projection: { _id: 0, data: 1 } }),
    ]);

    return NextResponse.json({
      calls: calls.map((r) => r.data),
      puts: puts.map((r) => r.data),
      ticker_changes: {
        calls: callChanges?.data ?? null,
        puts: putChanges?.data ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching aggressive opportunities:', error);
    return NextResponse.json({ calls: [], puts: [], ticker_changes: { calls: null, puts: null } }, { status: 500 });
  }
}
