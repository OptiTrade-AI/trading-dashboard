import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getWatchlistsCollection } from '@/lib/collections';

/** GET — list all watchlists (without full batches by default) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const full = searchParams.get('full') === 'true';
    const col = await getWatchlistsCollection();

    const projection = full ? { _id: 0 } : { _id: 0, batches: 0 };
    const items = await col.find({}, { projection }).toArray();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error reading watchlists:', error);
    return NextResponse.json({ error: 'Failed to read watchlists' }, { status: 500 });
  }
}

/** POST — create a new watchlist */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, name, batches } = body;

    if (!slug || !name || !batches) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, name, batches' },
        { status: 400 },
      );
    }

    const col = await getWatchlistsCollection();

    const existing = await col.findOne({ slug });
    if (existing) {
      return NextResponse.json({ error: 'Watchlist with this slug already exists' }, { status: 409 });
    }

    const tickerCount = Object.values(batches as Record<string, string[]>)
      .reduce((sum, arr) => sum + arr.length, 0);

    const now = new Date().toISOString();
    const doc = {
      id: randomUUID(),
      slug,
      name,
      batches,
      tickerCount,
      createdAt: now,
      updatedAt: now,
    };

    await col.insertOne(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
  }
}

/** PATCH — update a watchlist by id */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, batches } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const col = await getWatchlistsCollection();

    // Allowlist updatable fields to prevent mass-assignment
    const safeUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name) safeUpdates.name = name;
    if (batches) {
      safeUpdates.batches = batches;
      safeUpdates.tickerCount = Object.values(batches as Record<string, string[]>)
        .reduce((sum, arr) => sum + arr.length, 0);
    }

    const result = await col.findOneAndUpdate(
      { id },
      { $set: safeUpdates },
      { returnDocument: 'after', projection: { _id: 0 } },
    );

    if (!result) {
      return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating watchlist:', error);
    return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
  }
}

/** DELETE — remove a watchlist by id */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required param: id' }, { status: 400 });
    }

    const col = await getWatchlistsCollection();
    const result = await col.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    return NextResponse.json({ error: 'Failed to delete watchlist' }, { status: 500 });
  }
}
