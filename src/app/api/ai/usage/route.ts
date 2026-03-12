import { NextResponse } from 'next/server';
import { getAIUsageCollection } from '@/lib/collections';
import type { AIUsageStats } from '@/types';

export async function GET() {
  try {
    const col = await getAIUsageCollection();
    const allRecords = await col.find({}).sort({ timestamp: -1 }).toArray();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let today = 0, thisWeek = 0, thisMonth = 0, allTime = 0;
    const byFeature: Record<string, { calls: number; cost: number; tokens: number }> = {};
    const byModel: Record<string, { calls: number; cost: number }> = {};

    for (const r of allRecords) {
      allTime += r.costUsd;
      if (r.timestamp >= monthAgo) thisMonth += r.costUsd;
      if (r.timestamp >= weekAgo) thisWeek += r.costUsd;
      if (r.timestamp.slice(0, 10) === todayStr) today += r.costUsd;

      if (!byFeature[r.feature]) byFeature[r.feature] = { calls: 0, cost: 0, tokens: 0 };
      byFeature[r.feature].calls++;
      byFeature[r.feature].cost += r.costUsd;
      byFeature[r.feature].tokens += r.inputTokens + r.outputTokens;

      if (!byModel[r.model]) byModel[r.model] = { calls: 0, cost: 0 };
      byModel[r.model].calls++;
      byModel[r.model].cost += r.costUsd;
    }

    const stats: AIUsageStats = {
      today,
      thisWeek,
      thisMonth,
      allTime,
      byFeature,
      byModel,
      recentCalls: allRecords.slice(0, 20).map(r => ({
        timestamp: r.timestamp,
        feature: r.feature,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        ticker: r.ticker,
      })),
    };

    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ today: 0, thisWeek: 0, thisMonth: 0, allTime: 0, byFeature: {}, byModel: {}, recentCalls: [] });
  }
}
