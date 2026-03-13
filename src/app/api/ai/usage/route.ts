import { NextResponse } from 'next/server';
import { getAIUsageCollection } from '@/lib/collections';
import type { AIUsageStats, DailyCostEntry } from '@/types';

export async function GET() {
  try {
    const col = await getAIUsageCollection();
    const allRecords = await col.find({}).sort({ timestamp: -1 }).toArray();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let todayCost = 0, yesterdayCost = 0, thisWeek = 0, thisMonth = 0, allTime = 0;
    const byFeature: Record<string, { calls: number; cost: number; tokens: number }> = {};
    const byFeatureDetailed: Record<string, {
      calls: number; cost: number; inputTokens: number; outputTokens: number; avgCostPerCall: number;
    }> = {};
    const byModel: Record<string, { calls: number; cost: number }> = {};
    const dailyMap: Record<string, { cost: number; calls: number; byModel: Record<string, number> }> = {};

    for (const r of allRecords) {
      allTime += r.costUsd;
      const dateStr = r.timestamp.slice(0, 10);

      if (dateStr === todayStr) todayCost += r.costUsd;
      if (dateStr === yesterdayStr) yesterdayCost += r.costUsd;
      if (r.timestamp >= monthAgo) thisMonth += r.costUsd;
      if (r.timestamp >= weekAgo) thisWeek += r.costUsd;

      // byFeature (legacy)
      if (!byFeature[r.feature]) byFeature[r.feature] = { calls: 0, cost: 0, tokens: 0 };
      byFeature[r.feature].calls++;
      byFeature[r.feature].cost += r.costUsd;
      byFeature[r.feature].tokens += r.inputTokens + r.outputTokens;

      // byFeatureDetailed
      if (!byFeatureDetailed[r.feature]) {
        byFeatureDetailed[r.feature] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0, avgCostPerCall: 0 };
      }
      byFeatureDetailed[r.feature].calls++;
      byFeatureDetailed[r.feature].cost += r.costUsd;
      byFeatureDetailed[r.feature].inputTokens += r.inputTokens;
      byFeatureDetailed[r.feature].outputTokens += r.outputTokens;

      // byModel
      if (!byModel[r.model]) byModel[r.model] = { calls: 0, cost: 0 };
      byModel[r.model].calls++;
      byModel[r.model].cost += r.costUsd;

      // dailyMap (last 30 days only)
      if (r.timestamp >= monthAgo) {
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { cost: 0, calls: 0, byModel: {} };
        dailyMap[dateStr].cost += r.costUsd;
        dailyMap[dateStr].calls++;
        dailyMap[dateStr].byModel[r.model] = (dailyMap[dateStr].byModel[r.model] || 0) + r.costUsd;
      }
    }

    // Compute avgCostPerCall for each feature
    for (const f of Object.values(byFeatureDetailed)) {
      f.avgCostPerCall = f.calls > 0 ? f.cost / f.calls : 0;
    }

    // Fill daily costs for last 30 days (zero-fill gaps)
    const dailyCosts: DailyCostEntry[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().slice(0, 10);
      const entry = dailyMap[ds];
      dailyCosts.push({
        date: ds,
        cost: entry?.cost || 0,
        calls: entry?.calls || 0,
        byModel: entry?.byModel || {},
      });
    }

    const avgDailyLast30 = dailyCosts.reduce((s, d) => s + d.cost, 0) / 30;

    const stats: AIUsageStats = {
      today: todayCost,
      yesterday: yesterdayCost,
      thisWeek: thisWeek,
      thisMonth: thisMonth,
      allTime,
      avgDailyLast30,
      totalCalls: allRecords.length,
      dailyCosts,
      byFeature,
      byFeatureDetailed,
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
    return NextResponse.json({
      today: 0, yesterday: 0, thisWeek: 0, thisMonth: 0, allTime: 0,
      avgDailyLast30: 0, totalCalls: 0, dailyCosts: [],
      byFeature: {}, byFeatureDetailed: {}, byModel: {}, recentCalls: [],
    });
  }
}
