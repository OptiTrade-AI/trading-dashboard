import { NextResponse } from 'next/server';
import { Collection, Filter } from 'mongodb';

export function createTradeHandlers<T extends { id: string }>(
  getCollection: () => Promise<Collection<T>>,
  entityName: string
) {
  async function GET() {
    try {
      const col = await getCollection();
      const items = await col.find({}, { projection: { _id: 0 } }).toArray();
      return NextResponse.json(items);
    } catch (error) {
      console.error(`Error reading ${entityName}s:`, error);
      return NextResponse.json({ error: `Failed to read ${entityName}s` }, { status: 500 });
    }
  }

  async function POST(request: Request) {
    try {
      const item = await request.json();
      const col = await getCollection();
      await col.insertOne(item);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`Error adding ${entityName}:`, error);
      return NextResponse.json({ success: false, error: `Failed to add ${entityName}` }, { status: 500 });
    }
  }

  async function PATCH(request: Request) {
    try {
      const { id, ...updates } = await request.json();
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ success: false, error: `Missing ${entityName} id` }, { status: 400 });
      }
      const col = await getCollection();
      const result = await col.updateOne({ id } as Filter<T>, { $set: updates });
      if (result.matchedCount === 0) {
        return NextResponse.json({ success: false, error: `${entityName} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`Error updating ${entityName}:`, error);
      return NextResponse.json({ success: false, error: `Failed to update ${entityName}` }, { status: 500 });
    }
  }

  async function DELETE(request: Request) {
    try {
      const { id } = await request.json();
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ success: false, error: `Missing ${entityName} id` }, { status: 400 });
      }
      const col = await getCollection();
      const result = await col.deleteOne({ id } as Filter<T>);
      if (result.deletedCount === 0) {
        return NextResponse.json({ success: false, error: `${entityName} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      return NextResponse.json({ success: false, error: `Failed to delete ${entityName}` }, { status: 500 });
    }
  }

  return { GET, POST, PATCH, DELETE };
}
