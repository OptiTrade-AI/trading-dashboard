import { NextResponse } from 'next/server';
import { spawnPipeline, isRunning } from '@/lib/pipeline-runner';
import type { PipelineType } from '@/types';

const VALID_TYPES: PipelineType[] = [
  'AGGRESSIVE_OPTIONS', 'CSP_ENHANCED',
  'PCS_SCREENER', 'CHART_SETUPS', 'SWING_TRADES',
];

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const pipelineType = type.toUpperCase() as PipelineType;

  if (!VALID_TYPES.includes(pipelineType)) {
    return NextResponse.json({ error: `Invalid pipeline type: ${type}` }, { status: 400 });
  }

  if (isRunning(pipelineType)) {
    return NextResponse.json({ error: `Pipeline ${pipelineType} is already running` }, { status: 409 });
  }

  try {
    const { runId } = await spawnPipeline(pipelineType);
    return NextResponse.json({ runId, status: 'RUNNING' });
  } catch (error) {
    console.error(`Error starting pipeline ${pipelineType}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start pipeline' },
      { status: 500 },
    );
  }
}
