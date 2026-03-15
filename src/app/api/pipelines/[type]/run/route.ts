import { NextResponse } from 'next/server';
import { spawnPipeline, isRunning } from '@/lib/pipeline-runner';
import type { PipelineType } from '@/types';

const VALID_TYPES: PipelineType[] = [
  'AGGRESSIVE_OPTIONS', 'CSP_ENHANCED',
];

export async function POST(
  request: Request,
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

  // Parse optional tickers from body
  let tickers: string[] | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.tickers) && body.tickers.length > 0) {
      tickers = body.tickers.map((t: string) => t.trim().toUpperCase()).filter(Boolean);
    }
  } catch {
    // No body or invalid JSON — run with all tickers
  }

  try {
    const { runId } = await spawnPipeline(pipelineType, { tickers });
    return NextResponse.json({ runId, status: 'RUNNING', tickers: tickers?.length ?? 'all' });
  } catch (error) {
    console.error(`Error starting pipeline ${pipelineType}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start pipeline' },
      { status: 500 },
    );
  }
}
