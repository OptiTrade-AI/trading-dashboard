import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { existsSync } from 'fs';
import type { PipelineType, PipelineRunStatus } from '@/types';
import { getPipelineRunsCollection, getPipelineResultsCollection } from './collections';

// Force-load .env — Turbopack doesn't reliably populate process.env.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const SCRIPT_MAP: Record<PipelineType, string> = {
  AGGRESSIVE_OPTIONS: 'app.pipelines.aggressive_options',
  CSP_SCREENER: 'app.pipelines.csp_screener',
  CSP_ENHANCED: 'app.pipelines.csp_enhanced',
  PCS_SCREENER: 'app.pipelines.pcs_screener',
  CHART_SETUPS: 'app.pipelines.chart_setups',
  SWING_TRADES: 'app.pipelines.swing_trades.runner',
};

export interface ProgressEvent {
  type: 'progress' | 'complete';
  step?: number;
  total_steps?: number;
  message?: string;
  pct?: number;
  total?: number;
  new?: number;
}

export interface RunInfo {
  id: string;
  pipelineType: PipelineType;
  status: PipelineRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  totalOpportunities: number | null;
  newOpportunities: number | null;
  progress: ProgressEvent | null;
}

/** In-memory tracking of all runs (active + recent) */
const runs = new Map<string, RunInfo>();
const activeByType = new Map<PipelineType, string>();

export function isRunning(type: PipelineType): boolean {
  return activeByType.has(type);
}

export function getRunInfo(runId: string): RunInfo | undefined {
  return runs.get(runId);
}

export function getActiveRunId(type: PipelineType): string | undefined {
  return activeByType.get(type);
}

/** Get recent runs for a pipeline type, newest first */
export function getRunHistory(type: PipelineType, limit = 10): RunInfo[] {
  return [...runs.values()]
    .filter((r) => r.pipelineType === type)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit);
}

/** Persist run record to MongoDB — non-blocking, never throws */
async function dbCreateRun(info: RunInfo): Promise<void> {
  try {
    const col = await getPipelineRunsCollection();
    await col.insertOne({
      id: info.id,
      pipelineType: info.pipelineType,
      status: 'RUNNING',
      startedAt: info.startedAt.toISOString(),
      completedAt: null,
      durationMs: null,
      error: null,
      totalOpportunities: null,
      newOpportunities: null,
    });
  } catch (err) {
    console.error('Failed to create pipeline run in MongoDB:', err);
  }
}

async function dbUpdateRun(info: RunInfo): Promise<void> {
  try {
    const col = await getPipelineRunsCollection();
    await col.updateOne(
      { id: info.id },
      {
        $set: {
          status: info.status,
          completedAt: info.completedAt?.toISOString() ?? null,
          durationMs: info.durationMs,
          error: info.error,
          totalOpportunities: info.totalOpportunities,
          newOpportunities: info.newOpportunities,
        },
      },
    );
  } catch (err) {
    console.error('Failed to update pipeline run in MongoDB:', err);
  }
}

/** Count results written by the Python pipeline for this run */
async function countRunResults(runId: string): Promise<{ total: number; new: number }> {
  try {
    const col = await getPipelineResultsCollection();
    const total = await col.countDocuments({ pipelineRunId: runId, ticker: { $ne: '_meta' } });
    return { total, new: 0 };
  } catch {
    return { total: 0, new: 0 };
  }
}

function resolveScriptsDir(): string {
  const dir = process.env.PIPELINE_SCRIPTS_DIR || '';
  if (!dir) {
    throw new Error(
      'Cannot run pipeline: PIPELINE_SCRIPTS_DIR is not set.\n' +
      'Add it to .env:\n' +
      '  PIPELINE_SCRIPTS_DIR=/path/to/optitrade/pipelines'
    );
  }
  if (!existsSync(dir)) {
    throw new Error(`PIPELINE_SCRIPTS_DIR="${dir}" but that directory does not exist.`);
  }
  return dir;
}

function resolvePython(scriptsDir: string): string {
  const py = process.env.PYTHON_PATH || 'python';
  if (py.startsWith('/') && !existsSync(py)) {
    const venvPy = join(scriptsDir, 'venv', 'bin', 'python');
    if (existsSync(venvPy)) return venvPy;
    throw new Error(
      `PYTHON_PATH="${py}" does not exist.\n` +
      `Set PYTHON_PATH in .env to your Python binary, e.g.:\n` +
      `  PYTHON_PATH=${venvPy}`
    );
  }
  return py;
}

/**
 * Spawn a Python pipeline subprocess.
 * Python writes results directly to MongoDB.
 * Next.js tracks run status in-memory + MongoDB.
 */
export async function spawnPipeline(type: PipelineType): Promise<{ runId: string }> {
  if (activeByType.has(type)) {
    throw new Error(`Pipeline ${type} is already running`);
  }

  const scriptsDir = resolveScriptsDir();
  const pythonBin = resolvePython(scriptsDir);

  const module = SCRIPT_MAP[type];
  if (!module) {
    throw new Error(`Unknown pipeline type: ${type}`);
  }

  const runId = randomUUID();
  const info: RunInfo = {
    id: runId,
    pipelineType: type,
    status: 'RUNNING',
    startedAt: new Date(),
    completedAt: null,
    durationMs: null,
    error: null,
    totalOpportunities: null,
    newOpportunities: null,
    progress: null,
  };

  runs.set(runId, info);
  activeByType.set(type, runId);

  // Persist run record before spawning
  await dbCreateRun(info);

  // Pass --run-id so Python writes results to MongoDB linked to this run
  const child = spawn(pythonBin, ['-m', module, '--run-id', runId], {
    cwd: scriptsDir,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      MONGODB_URI: process.env.MONGODB_URI ?? '',
      MONGODB_DB: process.env.MONGODB_DB ?? '',
      POLYGON_API_KEY: process.env.POLYGON_API_KEY ?? '',
      PYTHON_PATH: process.env.PYTHON_PATH ?? '',
      PYTHONUNBUFFERED: '1',
    } as unknown as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const timeout = setTimeout(() => {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 5000);
  }, PIPELINE_TIMEOUT_MS);

  let stderr = '';

  child.stdout.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ProgressEvent;
        if (event.type === 'progress' || event.type === 'complete') {
          info.progress = event;
        }
      } catch {
        // Not JSON — regular log output, ignore
      }
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    console.error(`[pipeline:${type}] ${text.trimEnd()}`);
  });

  child.on('close', async (code) => {
    clearTimeout(timeout);
    activeByType.delete(type);

    const completedAt = new Date();
    info.completedAt = completedAt;
    info.durationMs = completedAt.getTime() - info.startedAt.getTime();

    if (code === 0) {
      info.status = 'COMPLETED';
      console.log(`[pipeline:${type}] Completed in ${info.durationMs}ms`);

      const counts = await countRunResults(runId);
      info.totalOpportunities = counts.total;
      info.newOpportunities = counts.new;
    } else {
      info.status = 'FAILED';
      info.error = stderr.slice(-2000) || `Process exited with code ${code}`;
      console.error(`[pipeline:${type}] FAILED (exit ${code}):\n${info.error}`);
    }

    await dbUpdateRun(info);
  });

  child.on('error', async (err) => {
    clearTimeout(timeout);
    activeByType.delete(type);

    info.status = 'FAILED';
    info.completedAt = new Date();
    info.durationMs = info.completedAt.getTime() - info.startedAt.getTime();
    info.error = `Failed to spawn Python: ${err.message}. Check PYTHON_PATH in .env`;
    console.error(`[pipeline:${type}] ${info.error}`);

    await dbUpdateRun(info);
  });

  return { runId };
}
