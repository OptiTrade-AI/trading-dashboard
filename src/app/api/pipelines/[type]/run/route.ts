import { NextResponse } from 'next/server';
import { spawnPipeline, isRunning } from '@/lib/pipeline-runner';
import { getPipelineConfigCollection } from '@/lib/collections';
import { DEFAULT_CSP_CONFIG } from '@/lib/pipeline-defaults';
import type { PipelineType } from '@/types';

const VALID_TYPES: PipelineType[] = [
  'AGGRESSIVE_OPTIONS', 'CSP_SCREENER',
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

  // Parse optional tickers and config from body
  let tickers: string[] | undefined;
  let config: Record<string, unknown> | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.tickers) && body.tickers.length > 0) {
      tickers = body.tickers.map((t: string) => t.trim().toUpperCase()).filter(Boolean);
    }
    if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
      config = body.config;
    }
  } catch {
    // No body or invalid JSON — run with defaults
  }

  // If no config in body, load saved config from DB
  if (!config && pipelineType === 'CSP_SCREENER') {
    try {
      const col = await getPipelineConfigCollection();
      const doc = await col.findOne({ pipelineType }, { projection: { _id: 0 } });
      config = { ...(doc?.config ?? DEFAULT_CSP_CONFIG) };
    } catch {
      config = { ...DEFAULT_CSP_CONFIG };
    }
  }

  try {
    const { runId } = await spawnPipeline(pipelineType, { tickers, config });
    return NextResponse.json({ runId, status: 'RUNNING', tickers: tickers?.length ?? 'all' });
  } catch (error) {
    console.error(`Error starting pipeline ${pipelineType}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start pipeline' },
      { status: 500 },
    );
  }
}
