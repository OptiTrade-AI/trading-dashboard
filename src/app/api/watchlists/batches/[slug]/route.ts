import { NextResponse } from 'next/server';
import { getWatchlistsCollection } from '@/lib/collections';

/**
 * GET /api/watchlists/batches/[slug]
 * Returns just the batches object for a watchlist — consumed by Python pipelines.
 * Example: GET /api/watchlists/batches/main-batches → { "batch_1": ["AAPL", ...], ... }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const col = await getWatchlistsCollection();
    const doc = await col.findOne({ slug }, { projection: { _id: 0, batches: 1 } });

    if (!doc) {
      return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    return NextResponse.json(doc.batches);
  } catch (error) {
    console.error('Error reading watchlist batches:', error);
    return NextResponse.json({ error: 'Failed to read watchlist batches' }, { status: 500 });
  }
}
