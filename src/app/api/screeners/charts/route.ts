import { NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';
import type { ChartSetup } from '@/types';

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();
    const latestRun = await runsCol.findOne(
      { pipelineType: 'CHART_SETUPS', status: 'COMPLETED' },
      { sort: { completedAt: -1 } },
    );

    if (!latestRun) {
      return NextResponse.json({ timestamp: null, total_setups_found: 0, chart_setups: [] });
    }

    const resultsCol = await getPipelineResultsCollection();
    const results = await resultsCol
      .find(
        { pipelineRunId: latestRun.id, opportunityType: 'chart_setup' },
        { projection: { _id: 0, data: 1 } },
      )
      .toArray();

    const setups: ChartSetup[] = results.map((r) => r.data);

    return NextResponse.json({
      timestamp: latestRun.completedAt ?? latestRun.startedAt,
      total_setups_found: setups.length,
      chart_setups: setups,
    });
  } catch (error) {
    console.error('Error fetching chart setups:', error);
    return NextResponse.json({ timestamp: null, total_setups_found: 0, chart_setups: [] }, { status: 500 });
  }
}
