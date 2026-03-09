import { NextResponse } from 'next/server';
import { getCoveredCallsCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getCoveredCallsCollection();
    const calls = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(calls);
  } catch (error) {
    console.error('Error reading covered calls:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const call = await request.json();
    const col = await getCoveredCallsCollection();
    await col.insertOne(call);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding covered call:', error);
    return NextResponse.json({ success: false, error: 'Failed to add covered call' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing call id' }, { status: 400 });
    }
    const col = await getCoveredCallsCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating covered call:', error);
    return NextResponse.json({ success: false, error: 'Failed to update covered call' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing call id' }, { status: 400 });
    }
    const col = await getCoveredCallsCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting covered call:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete covered call' }, { status: 500 });
  }
}
