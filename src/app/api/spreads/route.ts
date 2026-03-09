import { NextResponse } from 'next/server';
import { getSpreadsCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getSpreadsCollection();
    const trades = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Error reading spreads:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const trade = await request.json();
    const col = await getSpreadsCollection();
    await col.insertOne(trade);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding spread:', error);
    return NextResponse.json({ success: false, error: 'Failed to add spread' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getSpreadsCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating spread:', error);
    return NextResponse.json({ success: false, error: 'Failed to update spread' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getSpreadsCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting spread:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete spread' }, { status: 500 });
  }
}
