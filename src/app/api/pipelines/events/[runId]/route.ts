import { getRunInfo } from '@/lib/pipeline-runner';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const encoder = new TextEncoder();
  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
        try { controller.close(); } catch { /* already closed */ }
      };
      cleanupFn = cleanup;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      // Poll every 500ms for status updates
      const interval = setInterval(() => {
        if (closed) return;

        const info = getRunInfo(runId);
        if (!info) {
          send({ status: 'NOT_FOUND', error: 'Run not found' });
          cleanup();
          return;
        }

        send({
          status: info.status,
          progress: info.progress,
          durationMs: info.durationMs ?? (Date.now() - info.startedAt.getTime()),
          totalOpportunities: info.totalOpportunities,
          error: info.error,
        });

        if (info.status === 'COMPLETED' || info.status === 'FAILED') {
          cleanup();
        }
      }, 500);

      // Timeout after 15 minutes
      const timeout = setTimeout(cleanup, 15 * 60 * 1000);
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
