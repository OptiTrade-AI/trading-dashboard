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
    const limit = Math.min(parseInt(params.get('limit') || '20', 10) || 20, 50);
    const offset = parseInt(params.get('offset') || '0', 10) || 0;
    const featureParam = params.get('feature');
    const feature = featureParam === 'cc-optimizer' || featureParam === 'csp-optimizer' ? featureParam : null;

    // cc-optimizer: match explicit 'cc-optimizer' OR legacy traces without a feature field
    // csp-optimizer: match only explicit 'csp-optimizer'
    const filter: Record<string, unknown> = {};
    if (feature === 'cc-optimizer') {
      filter.$or = [{ feature: 'cc-optimizer' }, { feature: { $exists: false } }];
    } else if (feature) {
      filter.feature = feature;
    }

    const traces = await col
      .find(filter, {
        projection: {
          id: 1,
          name: 1,
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
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $sort: { createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      { $project: { _id: 0, id: '$id', stepCount: { $size: { $ifNull: ['$steps', []] } } } },
    ]).toArray();
    const stepCounts = new Map(stepCountDocs.map(d => [d.id, d.stepCount]));

    const result = traces.map(t => ({
      id: t.id,
      name: t.name,
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body as { id?: string; name?: string };

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing trace id' }, { status: 400 });
    }

    const trimmed = typeof name === 'string' ? name.trim().slice(0, 100) : '';

    const col = await getAgentTracesCollection();
    const result = await col.updateOne({ id }, { $set: { name: trimmed || undefined } });
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, name: trimmed || null });
  } catch (err) {
    console.error('Agent trace update error:', err);
    return NextResponse.json({ error: 'Failed to update trace' }, { status: 500 });
  }
}
