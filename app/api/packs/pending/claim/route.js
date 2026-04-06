import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, revealId } = body || {};
    if (!userId || !revealId) {
      return NextResponse.json({ error: 'User ID and reveal ID required' }, { status: 400 });
    }

    const database = await connectDB();
    await database.collection('pack_reveals').updateOne(
      { id: revealId, userId },
      { $set: { revealed: true, revealedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to claim pack reveal' }, { status: 500 });
  }
}
