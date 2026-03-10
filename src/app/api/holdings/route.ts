import { NextResponse } from 'next/server';
import { getHoldingsCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getHoldingsCollection();
    const holdings = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(holdings);
  } catch (error) {
    console.error('Error reading holdings:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const holding = await request.json();
    const col = await getHoldingsCollection();
    await col.insertOne(holding);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding holding:', error);
    return NextResponse.json({ success: false, error: 'Failed to add holding' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing holding id' }, { status: 400 });
    }
    const col = await getHoldingsCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Holding not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating holding:', error);
    return NextResponse.json({ success: false, error: 'Failed to update holding' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing holding id' }, { status: 400 });
    }
    const col = await getHoldingsCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Holding not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting holding:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete holding' }, { status: 500 });
  }
}
