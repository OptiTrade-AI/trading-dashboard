'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import {
  usePipelines,
  useCspOpportunities,
  useAggressiveOpportunities,
} from './useScreenerData';
import { usePipelineProgress } from './usePipelineProgress';
import type {
  ScreenerTab,
  PipelineType,
  CspOpportunity,
} from '@/types';

/** Maps screener tab → pipeline type(s) that feed it */
const TAB_PIPELINE_MAP: Record<ScreenerTab, PipelineType[]> = {
  csp: ['CSP_ENHANCED'],
  aggressive: ['AGGRESSIVE_OPTIONS'],
};

/** Pipeline run order for "Run All" */
const RUN_ALL_ORDER: PipelineType[] = [
  'CSP_ENHANCED',
  'AGGRESSIVE_OPTIONS',
];

export function useScreenerHub() {
  // ----- Data hooks -----
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: cspData, isLoading: cspLoading } = useCspOpportunities();
  const { data: aggressiveData, isLoading: aggLoading } = useAggressiveOpportunities();

  // ----- Pipeline run state -----
  const [runningPipelines, setRunningPipelines] = useState<Record<string, string>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunType, setActiveRunType] = useState<string | null>(null);
  const [runAllQueue, setRunAllQueue] = useState<PipelineType[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const { event: progressEvent, reset: resetProgress } = usePipelineProgress(activeRunId);

  // Handle pipeline completion
  useEffect(() => {
    if (!progressEvent || !activeRunType) return;
    if (progressEvent.status === 'COMPLETED' || progressEvent.status === 'FAILED') {
      mutate('/api/pipelines');
      const timer = setTimeout(() => {
        setRunningPipelines((prev) => {
          const next = { ...prev };
          delete next[activeRunType];
          return next;
        });
        setActiveRunId(null);
        setActiveRunType(null);
        resetProgress();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [progressEvent, activeRunType, resetProgress]);

  const runPipeline = useCallback(
    async (pipelineType: string, tickers?: string[]) => {
      try {
        const body: Record<string, unknown> = {};
        if (tickers?.length) body.tickers = tickers;

        const res = await fetch(`/api/pipelines/${pipelineType}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to start pipeline');
        const data = await res.json();
        const runId = data.runId as string;

        setRunningPipelines((prev) => ({ ...prev, [pipelineType]: runId }));
        setActiveRunId(runId);
        setActiveRunType(pipelineType);
        resetProgress();
      } catch (err) {
        console.error('Failed to run pipeline:', err);
      }
    },
    [resetProgress],
  );

  // Keep a stable ref to runPipeline for the "Run All" effect
  const runPipelineRef = useRef(runPipeline);
  runPipelineRef.current = runPipeline;

  // Process "Run All" queue
  useEffect(() => {
    if (!isRunningAll || runAllQueue.length === 0) {
      if (isRunningAll && runAllQueue.length === 0 && !activeRunId) {
        setIsRunningAll(false);
      }
      return;
    }
    // Only start next if nothing is actively running
    if (activeRunId) return;

    const next = runAllQueue[0];
    setRunAllQueue((q) => q.slice(1));
    runPipelineRef.current(next);
  }, [isRunningAll, runAllQueue, activeRunId]);

  const runAll = useCallback(() => {
    if (isRunningAll) return;
    setIsRunningAll(true);
    setRunAllQueue([...RUN_ALL_ORDER]);
  }, [isRunningAll]);

  // ----- Counts -----
  const counts = useMemo(
    () => ({
      csp: cspData?.length ?? 0,
      aggressive: (aggressiveData?.calls?.length ?? 0) + (aggressiveData?.puts?.length ?? 0),
    }),
    [cspData, aggressiveData],
  );

  const totalOpportunities = useMemo(
    () => Object.values(counts).reduce((s, c) => s + c, 0),
    [counts],
  );

  // ----- Top picks -----
  const topCsp = useMemo(() => {
    if (!cspData || cspData.length === 0) return null;
    return [...cspData].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] as CspOpportunity;
  }, [cspData]);

  // ----- Pipeline health -----
  const pipelineHealth = useMemo(() => {
    if (!pipelines) return { recent: 0, total: 0, failed: 0, stale: 0 };
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const now = Date.now();
    let recent = 0;
    let failed = 0;
    let stale = 0;
    for (const p of pipelines) {
      if (p.lastRunAt && now - new Date(p.lastRunAt).getTime() < sixHoursMs) {
        recent++;
      } else {
        stale++;
      }
      if (p.lastRunStatus === 'FAILED') failed++;
    }
    return { recent, total: pipelines.length, failed, stale };
  }, [pipelines]);

  // ----- Pipeline info for a tab -----
  const getPipelineForTab = useCallback(
    (tab: ScreenerTab) => {
      if (!pipelines) return null;
      const types = TAB_PIPELINE_MAP[tab];
      return pipelines.find((p) => types.includes(p.type)) ?? null;
    },
    [pipelines],
  );

  return {
    // Data
    cspData: cspData ?? [],
    aggressiveData,
    pipelines: pipelines ?? [],
    // Loading
    isLoading: pipelinesLoading || cspLoading || aggLoading,
    pipelinesLoading,
    // Counts
    counts,
    totalOpportunities,
    // Top picks & insights
    topCsp,
    pipelineHealth,
    // Pipeline controls
    runningPipelines,
    activeRunId,
    activeRunType,
    progressEvent,
    isRunningAll,
    runPipeline,
    runAll,
    getPipelineForTab,
  };
}
