import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, tradeId } = await request.json();
    if (!userId || !tradeId) {
      return NextResponse.json({ error: 'User ID and Trade ID required' }, { status: 400 });
    }

    const database = await connectDB();
    await database.collection('users').updateOne({ id: userId }, { $pull: { tradeRequests: { id: tradeId } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to decline Pokémon trade' }, { status: 500 });
  }
}
