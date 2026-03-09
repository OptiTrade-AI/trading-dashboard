import { NextResponse } from 'next/server';
import { getStockEventsCollection } from '@/lib/collections';

export async function GET() {
  try {
    const col = await getStockEventsCollection();
    const events = await col.find({}, { projection: { _id: 0 } }).toArray();
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error reading stock events:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const event = await request.json();
    const col = await getStockEventsCollection();
    await col.insertOne(event);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding stock event:', error);
    return NextResponse.json({ success: false, error: 'Failed to add stock event' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing event id' }, { status: 400 });
    }
    const col = await getStockEventsCollection();
    const result = await col.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating stock event:', error);
    return NextResponse.json({ success: false, error: 'Failed to update stock event' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing event id' }, { status: 400 });
    }
    const col = await getStockEventsCollection();
    const result = await col.deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock event:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete stock event' }, { status: 500 });
  }
}
