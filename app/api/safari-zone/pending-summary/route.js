import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    const database = await connectDB();
    const summaries = database.collection('safari_zone_summaries');
    const summary = await summaries.findOne({ userId, unread: true }, { sort: { finishedAt: -1 } });
    if (!summary) return NextResponse.json({ success: true, summary: null });
    await summaries.updateOne({ _id: summary._id }, { $set: { unread: false } });
    return NextResponse.json({ success: true, summary: { biomeName: summary.biomeName, finishedAt: summary.finishedAt, encounterLog: summary.encounterLog || [] } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load Safari summary' }, { status: 500 });
  }
}
