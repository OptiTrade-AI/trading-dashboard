import { NextResponse } from 'next/server';
import { getPipelineRunsCollection } from '@/lib/collections';
import { isRunning, getRunHistory } from '@/lib/pipeline-runner';
import type { PipelineType, PipelineInfo } from '@/types';

const PIPELINE_CONFIGS: { type: PipelineType; name: string; description: string }[] = [
  { type: 'AGGRESSIVE_OPTIONS', name: 'Aggressive Options', description: 'Identifies overbought/oversold tickers with high-conviction option contracts' },
  { type: 'CSP_SCREENER', name: 'CSP Screener', description: 'Optimized CSP screener with bulk fetching and early market cap filtering' },
];

export async function GET() {
  try {
    const runsCol = await getPipelineRunsCollection();

    const pipelines: PipelineInfo[] = await Promise.all(
      PIPELINE_CONFIGS.map(async (config) => {
        // Check in-memory first for running status
        const running = isRunning(config.type);
        const memHistory = getRunHistory(config.type, 1);

        // Get latest run from DB
        const dbRun = await runsCol.findOne(
          { pipelineType: config.type === 'CSP_SCREENER' ? { $in: ['CSP_SCREENER', 'CSP_ENHANCED' as never] } : config.type },
          { sort: { startedAt: -1 }, projection: { _id: 0 } },
        );

        const latestRun = running && memHistory[0]
          ? memHistory[0]
          : dbRun;

        return {
          type: config.type,
          name: config.name,
          description: config.description,
          lastRunAt: latestRun?.startedAt
            ? (typeof latestRun.startedAt === 'string' ? latestRun.startedAt : latestRun.startedAt.toISOString())
            : null,
          lastRunStatus: running ? 'RUNNING' : (latestRun?.status ?? null),
          lastRunDuration: latestRun?.durationMs ?? null,
          totalOpportunities: latestRun?.totalOpportunities ?? null,
          cronExpression: null,
          enabled: true,
        };
      }),
    );

    return NextResponse.json(pipelines);
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json([], { status: 500 });
  }
}
