import { NextRequest, NextResponse } from 'next/server';
import { getPipelineConfigCollection } from '@/lib/collections';
import { DEFAULT_CSP_CONFIG } from '@/lib/pipeline-defaults';
import type { PipelineType, CspPipelineConfig } from '@/types';

const VALID_TYPES: PipelineType[] = ['CSP_SCREENER', 'AGGRESSIVE_OPTIONS'];

export async function GET(request: NextRequest) {
  const pipelineType = request.nextUrl.searchParams.get('pipelineType') as PipelineType | null;

  if (!pipelineType || !VALID_TYPES.includes(pipelineType)) {
    return NextResponse.json({ error: 'Invalid or missing pipelineType' }, { status: 400 });
  }

  try {
    const col = await getPipelineConfigCollection();
    const doc = await col.findOne({ pipelineType }, { projection: { _id: 0 } });

    const config: CspPipelineConfig = doc
      ? { ...DEFAULT_CSP_CONFIG, ...doc.config }
      : { ...DEFAULT_CSP_CONFIG };

    return NextResponse.json({ pipelineType, config });
  } catch (error) {
    console.error('Error fetching pipeline config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipelineType, config } = body as { pipelineType: PipelineType; config: Partial<CspPipelineConfig> };

    if (!pipelineType || !VALID_TYPES.includes(pipelineType)) {
      return NextResponse.json({ error: 'Invalid or missing pipelineType' }, { status: 400 });
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Missing config object' }, { status: 400 });
    }

    const col = await getPipelineConfigCollection();
    await col.updateOne(
      { pipelineType },
      { $set: { config: { ...DEFAULT_CSP_CONFIG, ...config }, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving pipeline config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
