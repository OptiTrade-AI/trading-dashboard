import { tavily } from '@tavily/core';

let client: ReturnType<typeof tavily> | null = null;

function getClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = tavily({ apiKey });
  }
  return client;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function webSearch(
  query: string,
  maxResults: number = 5,
): Promise<WebSearchResult[]> {
  const c = getClient();
  if (!c) return [];

  try {
    const response = await c.search(query, {
      maxResults,
      searchDepth: 'basic',
    });

    return (response.results || []).map((r: { title: string; url: string; content: string; score: number }) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  } catch {
    return [];
  }
}
