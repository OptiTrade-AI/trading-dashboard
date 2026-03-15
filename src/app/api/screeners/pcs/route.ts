import { NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';
import type { PcsOpportunity } from '@/types';

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();
    const latestRun = await runsCol.findOne(
      { pipelineType: 'PCS_SCREENER', status: 'COMPLETED' },
      { sort: { completedAt: -1 } },
    );

    if (!latestRun) {
      return NextResponse.json([]);
    }

    const resultsCol = await getPipelineResultsCollection();
    const results = await resultsCol
      .find(
        { pipelineRunId: latestRun.id, opportunityType: 'pcs' },
        { projection: { _id: 0, data: 1 } },
      )
      .toArray();

    const opportunities: PcsOpportunity[] = results.map((r) => r.data);

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('Error fetching PCS opportunities:', error);
    return NextResponse.json([], { status: 500 });
  }
}
