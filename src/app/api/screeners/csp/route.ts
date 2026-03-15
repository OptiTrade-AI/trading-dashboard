import { NextResponse } from 'next/server';
import { getPipelineResultsCollection, getPipelineRunsCollection } from '@/lib/collections';
import type { CspOpportunity } from '@/types';

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();

    // Find latest completed CSP Enhanced run
    const latestRun = await runsCol.findOne(
      { pipelineType: 'CSP_ENHANCED', status: 'COMPLETED' },
      { sort: { completedAt: -1 } },
    );

    if (!latestRun) {
      return NextResponse.json([]);
    }

    const resultsCol = await getPipelineResultsCollection();
    const results = await resultsCol
      .find(
        { pipelineRunId: latestRun.id, opportunityType: 'csp' },
        { projection: { _id: 0, data: 1, score: 1 } },
      )
      .toArray();

    // Data is already normalized and scored by Python
    const opportunities: CspOpportunity[] = results.map((r) => ({
      ...r.data,
      score: r.score ?? r.data.score ?? undefined,
    }));

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('Error fetching CSP opportunities:', error);
    return NextResponse.json([], { status: 500 });
  }
}
