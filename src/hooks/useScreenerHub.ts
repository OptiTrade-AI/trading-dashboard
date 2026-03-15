'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import {
  usePipelines,
  useCspOpportunities,
  usePcsOpportunities,
  useAggressiveOpportunities,
  useChartSetups,
  useSwingSignals,
} from './useScreenerData';
import { usePipelineProgress } from './usePipelineProgress';
import type {
  ScreenerTab,
  PipelineType,
  CspOpportunity,
  PcsOpportunity,
  SwingSignal,
} from '@/types';

/** Maps screener tab → pipeline type(s) that feed it */
const TAB_PIPELINE_MAP: Record<ScreenerTab, PipelineType[]> = {
  csp: ['CSP_ENHANCED'],
  pcs: ['PCS_SCREENER'],
  aggressive: ['AGGRESSIVE_OPTIONS'],
  charts: ['CHART_SETUPS'],
  swing: ['SWING_TRADES'],
};

/** Pipeline run order for "Run All" */
const RUN_ALL_ORDER: PipelineType[] = [
  'CSP_ENHANCED',
  'PCS_SCREENER',
  'AGGRESSIVE_OPTIONS',
  'CHART_SETUPS',
  'SWING_TRADES',
];

export function useScreenerHub() {
  // ----- Data hooks -----
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: cspData, isLoading: cspLoading } = useCspOpportunities();
  const { data: pcsData, isLoading: pcsLoading } = usePcsOpportunities();
  const { data: aggressiveData, isLoading: aggLoading } = useAggressiveOpportunities();
  const { data: chartsData, isLoading: chartsLoading } = useChartSetups();
  const { data: swingData, isLoading: swingLoading } = useSwingSignals();

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
    async (pipelineType: string) => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineType}/run`, { method: 'POST' });
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
      pcs: pcsData?.length ?? 0,
      aggressive: (aggressiveData?.calls?.length ?? 0) + (aggressiveData?.puts?.length ?? 0),
      charts: chartsData?.chart_setups?.length ?? 0,
      swing: (swingData?.long_signals?.length ?? 0) + (swingData?.short_signals?.length ?? 0),
    }),
    [cspData, pcsData, aggressiveData, chartsData, swingData],
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

  const topPcs = useMemo(() => {
    if (!pcsData || pcsData.length === 0) return null;
    return [...pcsData].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] as PcsOpportunity;
  }, [pcsData]);

  const confluenceTickers = useMemo(() => {
    if (!swingData) return [] as string[];
    const allSignals = [...(swingData.long_signals ?? []), ...(swingData.short_signals ?? [])];
    const stratMap = new Map<string, Set<string>>();
    for (const s of allSignals) {
      if (!stratMap.has(s.ticker)) stratMap.set(s.ticker, new Set());
      stratMap.get(s.ticker)!.add(s.strategy);
    }
    return Array.from(stratMap.entries())
      .filter(([, strats]) => strats.size >= 2)
      .map(([ticker]) => ticker);
  }, [swingData]);

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
    pcsData: pcsData ?? [],
    aggressiveData,
    chartsData,
    swingData,
    pipelines: pipelines ?? [],
    // Loading
    isLoading: pipelinesLoading || cspLoading || pcsLoading || aggLoading || chartsLoading || swingLoading,
    pipelinesLoading,
    // Counts
    counts,
    totalOpportunities,
    // Top picks & insights
    topCsp,
    topPcs,
    confluenceTickers,
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
