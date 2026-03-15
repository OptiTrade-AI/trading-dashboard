'use client';

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { fetcher } from '@/lib/fetcher';
import { DEFAULT_CSP_CONFIG, CSP_CONFIG_PRESETS } from '@/lib/pipeline-defaults';
import type { PipelineType, CspPipelineConfig } from '@/types';

export function usePipelineConfig(pipelineType: PipelineType) {
  const { data, mutate } = useSWR<{ pipelineType: PipelineType; config: CspPipelineConfig }>(
    `/api/pipeline-config?pipelineType=${pipelineType}`,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  const config: CspPipelineConfig = data?.config ?? DEFAULT_CSP_CONFIG;

  const [activePreset, setActivePreset] = useState<string | null>(null);

  const saveConfig = useCallback(async (newConfig: CspPipelineConfig) => {
    const prev = data;
    mutate({ pipelineType, config: newConfig }, false);
    try {
      const res = await fetch('/api/pipeline-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineType, config: newConfig }),
      });
      if (!res.ok) throw new Error('Save failed');
      mutate();
    } catch {
      // Revert optimistic update on failure
      if (prev) mutate(prev, false);
      else mutate();
    }
  }, [data, pipelineType, mutate]);

  const updateConfig = useCallback(async (partial: Partial<CspPipelineConfig>) => {
    await saveConfig({ ...config, ...partial });
  }, [config, saveConfig]);

  const resetConfig = useCallback(async () => {
    setActivePreset(null);
    await saveConfig({ ...DEFAULT_CSP_CONFIG });
  }, [saveConfig]);

  const setPreset = useCallback(async (key: string | null) => {
    if (!key) {
      setActivePreset(null);
      return;
    }
    const preset = CSP_CONFIG_PRESETS.find(p => p.key === key);
    if (!preset) return;
    setActivePreset(key);
    await saveConfig({ ...DEFAULT_CSP_CONFIG, ...preset.config });
  }, [saveConfig]);

  return { config, updateConfig, resetConfig, activePreset, setPreset };
}
