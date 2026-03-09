import { NextResponse } from 'next/server';
import { getDirectionalTradesCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getDirectionalTradesCollection();
    const trades = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Error reading directional trades:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const trade = await request.json();
    const col = await getDirectionalTradesCollection();
    await col.insertOne(trade);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding directional trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to add directional trade' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getDirectionalTradesCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating directional trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to update directional trade' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing trade id' }, { status: 400 });
    }
    const col = await getDirectionalTradesCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting directional trade:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete directional trade' }, { status: 500 });
  }
}
