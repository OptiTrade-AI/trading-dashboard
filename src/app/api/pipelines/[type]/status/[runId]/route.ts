import { NextResponse } from 'next/server';
import { getRunInfo } from '@/lib/pipeline-runner';
import { getPipelineRunsCollection } from '@/lib/collections';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; runId: string }> },
) {
  const { runId } = await params;

  // Check in-memory first (active runs)
  const memInfo = getRunInfo(runId);
  if (memInfo) {
    return NextResponse.json({
      id: memInfo.id,
      pipelineType: memInfo.pipelineType,
      status: memInfo.status,
      startedAt: memInfo.startedAt.toISOString(),
      completedAt: memInfo.completedAt?.toISOString() ?? null,
      durationMs: memInfo.durationMs,
      error: memInfo.error,
      totalOpportunities: memInfo.totalOpportunities,
      newOpportunities: memInfo.newOpportunities,
      progress: memInfo.progress,
    });
  }

  // Fall back to DB
  try {
    const col = await getPipelineRunsCollection();
    const run = await col.findOne({ id: runId }, { projection: { _id: 0 } });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('Error fetching run status:', error);
    return NextResponse.json({ error: 'Failed to fetch run status' }, { status: 500 });
  }
}
