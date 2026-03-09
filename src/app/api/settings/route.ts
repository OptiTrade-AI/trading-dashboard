import { NextResponse } from 'next/server';
import { getAccountSettingsCollection } from '@/lib/collections';

const DEFAULT_SETTINGS = {
  accountValue: 100000,
  maxHeatPercent: 30,
};

export async function GET() {
  try {
    const col = await getAccountSettingsCollection();
    const settings = await col.findOne({}, { projection: { _id: 0 } });
    return NextResponse.json(settings || DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(request: Request) {
  try {
    const settings = await request.json();
    const col = await getAccountSettingsCollection();
    await col.updateOne({}, { $set: settings }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
