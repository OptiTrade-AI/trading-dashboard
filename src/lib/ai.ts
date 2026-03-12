import Anthropic from '@anthropic-ai/sdk';
import { getAIUsageCollection } from './collections';
import type { AIFeature } from '@/types';

// Model pricing per million tokens (https://docs.anthropic.com/en/docs/about-claude/pricing)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
};

function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || MODEL_PRICING['claude-haiku-4-5-20251001'];
}

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * Track an AI API call's token usage and cost in MongoDB.
 * Call this after every Anthropic API response.
 */
export async function trackAICall(
  feature: AIFeature,
  model: string,
  inputTokens: number,
  outputTokens: number,
  ticker?: string,
): Promise<void> {
  try {
    const costUsd = calculateCost(model, inputTokens, outputTokens);
    const col = await getAIUsageCollection();
    await col.insertOne({
      timestamp: new Date().toISOString(),
      feature,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      ticker,
    });
  } catch {
    // Don't fail the request if tracking fails
  }
}

/**
 * Make a non-streaming Claude call and track usage.
 * Returns the text content and usage info.
 */
export async function aiCall(opts: {
  feature: AIFeature;
  model?: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  ticker?: string;
}): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const model = opts.model || 'claude-haiku-4-5-20251001';
  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens || 1024,
    system: opts.system,
    messages: opts.messages,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  const { input_tokens, output_tokens } = response.usage;
  await trackAICall(opts.feature, model, input_tokens, output_tokens, opts.ticker);

  return { text, inputTokens: input_tokens, outputTokens: output_tokens };
}

/**
 * Create a streaming Claude call and track usage when done.
 * Returns a ReadableStream and a promise that resolves with the full text.
 */
export function aiStream(opts: {
  feature: AIFeature;
  model?: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  ticker?: string;
}): { stream: ReadableStream; accumulated: Promise<string> } {
  const client = getAnthropicClient();
  if (!client) {
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('AI features require ANTHROPIC_API_KEY to be configured.'));
          controller.close();
        },
      }),
      accumulated: Promise.resolve(''),
    };
  }

  const model = opts.model || 'claude-haiku-4-5-20251001';
  let resolveAccumulated: (text: string) => void;
  const accumulated = new Promise<string>((resolve) => {
    resolveAccumulated = resolve;
  });

  const anthropicStream = client.messages.stream({
    model,
    max_tokens: opts.maxTokens || 1024,
    system: opts.system,
    messages: opts.messages,
  });

  let fullText = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Track usage after stream completes
        const finalMessage = await anthropicStream.finalMessage();
        const { input_tokens, output_tokens } = finalMessage.usage;
        await trackAICall(opts.feature, model, input_tokens, output_tokens, opts.ticker);

        resolveAccumulated(fullText);
        controller.close();
      } catch (err) {
        resolveAccumulated(fullText);
        controller.error(err);
      }
    },
  });

  return { stream: readableStream, accumulated };
}
