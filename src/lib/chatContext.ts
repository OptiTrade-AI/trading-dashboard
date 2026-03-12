export async function createChatWithContext(
  context: string,
  sourceFeature: string
): Promise<string> {
  const res = await fetch('/api/chat/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, sourceFeature }),
  });

  if (!res.ok) throw new Error('Failed to create chat context');
  const data = await res.json();
  return data.conversationId;
}
