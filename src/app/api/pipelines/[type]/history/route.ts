import { NextResponse } from 'next/server';
import { getPipelineRunsCollection } from '@/lib/collections';
import { getRunHistory } from '@/lib/pipeline-runner';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const pipelineType = type.toUpperCase();

  const VALID_TYPES = ['CSP_ENHANCED', 'AGGRESSIVE_OPTIONS'];
  if (!VALID_TYPES.includes(pipelineType)) {
    return NextResponse.json({ error: `Invalid pipeline type: ${pipelineType}` }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 100);

  try {
    // Try DB first for full history
    const col = await getPipelineRunsCollection();
    const dbRuns = await col
      .find({ pipelineType: pipelineType as import('@/types').PipelineType }, { projection: { _id: 0 } })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();

    if (dbRuns.length > 0) {
      return NextResponse.json(dbRuns);
    }

    // Fall back to in-memory
    const memRuns = getRunHistory(pipelineType as import('@/types').PipelineType, limit);
    return NextResponse.json(
      memRuns.map((r) => ({
        id: r.id,
        pipelineType: r.pipelineType,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        durationMs: r.durationMs,
        error: r.error,
        totalOpportunities: r.totalOpportunities,
        newOpportunities: r.newOpportunities,
      })),
    );
  } catch (error) {
    console.error('Error fetching pipeline history:', error);
    return NextResponse.json([], { status: 500 });
  }
}
