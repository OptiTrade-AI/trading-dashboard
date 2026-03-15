'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PipelineProgressEvent {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: {
    type: 'progress' | 'complete';
    step?: number;
    total_steps?: number;
    message?: string;
    pct?: number;
    total?: number;
  } | null;
  durationMs: number | null;
  totalOpportunities: number | null;
  error: string | null;
}

export function usePipelineProgress(runId: string | null) {
  const [event, setEvent] = useState<PipelineProgressEvent | null>(null);

  const reset = useCallback(() => setEvent(null), []);

  useEffect(() => {
    if (!runId) return;

    const source = new EventSource(`/api/pipelines/events/${runId}`);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as PipelineProgressEvent;
        setEvent(data);

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          source.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [runId]);

  return { event, reset };
}
