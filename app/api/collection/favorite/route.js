import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, cardId, favorite } = await request.json();
    if (!userId || !cardId || typeof favorite !== 'boolean') {
      return NextResponse.json({ error: 'User ID, card ID, and favorite flag required' }, { status: 400 });
    }

    const database = await connectDB();
    const update = favorite
      ? { $addToSet: { favoriteCardIds: cardId } }
      : { $pull: { favoriteCardIds: cardId } };

    await database.collection('users').updateOne({ id: userId }, update);

    return NextResponse.json({ success: true, favorite });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to update favorite' }, { status: 500 });
  }
}
