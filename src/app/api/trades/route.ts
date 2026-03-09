import { NextResponse } from 'next/server';
import { getCspTradesCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getCspTradesCollection();
    const trades = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Error reading trades:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// Add a single trade
export async function POST(request: Request) {
  try {
    const trade = await request.json();
    const col = await getCspTradesCollection();
    await col.insertOne(trade);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to add trade' }, { status: 500 });
  }
}

// Update a single trade by id
export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getCspTradesCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to update trade' }, { status: 500 });
  }
}

// Delete a single trade by id
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getCspTradesCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete trade' }, { status: 500 });
  }
}
