import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, cardId } = await request.json();
    if (!userId || !cardId) {
      return NextResponse.json({ error: 'User ID and card ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const user = await users.findOne(
      { id: userId },
      { projection: { id: 1, collection: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ownsCard = Array.isArray(user.collection) && user.collection.some((card) => card?.id === cardId);
    if (!ownsCard) {
      return NextResponse.json({ error: 'Card not found in user collection' }, { status: 404 });
    }

    await users.updateOne({ id: userId }, { $set: { favoriteCardId: String(cardId) } });
    return NextResponse.json({ success: true, favoriteCardId: String(cardId) });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to set favorite card' }, { status: 500 });
  }
}
