import { NextRequest, NextResponse } from 'next/server';
import { getAgentTracesCollection } from '@/lib/collections';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get('id');

  try {
    const col = await getAgentTracesCollection();

    // Single trace by ID
    if (id) {
      const trace = await col.findOne({ id });
      if (!trace) {
        return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
      }
      return NextResponse.json(trace);
    }

    // List traces (lightweight — omit steps and result for performance)
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 50);
    const offset = parseInt(params.get('offset') || '0', 10);

    const traces = await col
      .find({}, {
        projection: {
          id: 1,
          createdAt: 1,
          tickers: 1,
          mode: 1,
          totalDurationMs: 1,
          totalInputTokens: 1,
          totalOutputTokens: 1,
          costUsd: 1,
        },
      })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get step counts via aggregation (avoids fetching full step arrays)
    const stepCountDocs = await col.aggregate<{ id: string; stepCount: number }>([
      { $sort: { createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      { $project: { _id: 0, id: '$id', stepCount: { $size: { $ifNull: ['$steps', []] } } } },
    ]).toArray();
    const stepCounts = new Map(stepCountDocs.map(d => [d.id, d.stepCount]));

    const result = traces.map(t => ({
      id: t.id,
      createdAt: t.createdAt,
      tickers: t.tickers,
      mode: t.mode,
      totalDurationMs: t.totalDurationMs,
      totalInputTokens: t.totalInputTokens,
      totalOutputTokens: t.totalOutputTokens,
      costUsd: t.costUsd,
      stepCount: stepCounts.get(t.id) || 0,
    }));

    return NextResponse.json({ traces: result });
  } catch (err) {
    console.error('Agent traces fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch traces' }, { status: 500 });
  }
}
