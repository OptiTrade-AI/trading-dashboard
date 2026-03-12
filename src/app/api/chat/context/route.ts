import { NextRequest, NextResponse } from 'next/server';
import { getConversationsCollection } from '@/lib/collections';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { context, sourceFeature } = body as { context: string; sourceFeature?: string };

  if (!context) {
    return NextResponse.json({ error: 'Context required' }, { status: 400 });
  }

  // Cap context length to prevent oversized documents
  const safeContext = typeof context === 'string' ? context.slice(0, 10000) : '';
  if (!safeContext) {
    return NextResponse.json({ error: 'Context required' }, { status: 400 });
  }

  const conversationId = crypto.randomUUID();
  const now = new Date().toISOString();

  const title = sourceFeature
    ? `${sourceFeature} discussion`
    : safeContext.slice(0, 50) + (safeContext.length > 50 ? '...' : '');

  const col = await getConversationsCollection();
  await col.insertOne({
    id: conversationId,
    title,
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: safeContext,
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ conversationId });
}
