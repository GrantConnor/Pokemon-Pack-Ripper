import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { refreshAllUsersPointsIfDue, refreshUserPoints } from '@/lib/auth';
import { getBreakdownValueForRarity } from '@/lib/breakdown-values';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, cardId } = await request.json();
    if (!userId || !cardId) {
      return NextResponse.json({ error: 'User ID and card ID required' }, { status: 400 });
    }

    const database = await connectDB();
    await refreshAllUsersPointsIfDue(database);
    const users = database.collection('users');
    let user = await users.findOne({ id: userId }, { projection: { _id: 1, id: 1, username: 1, points: 1, createdAt: 1, lastPointsRefresh: 1, collection: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user = await refreshUserPoints(users, user);

    const matches = (user.collection || []).filter(card => card.id === cardId).sort((a, b) => new Date(a.pulledAt || 0) - new Date(b.pulledAt || 0));
    if (!matches.length) {
      return NextResponse.json({ error: 'Card not found in collection' }, { status: 404 });
    }

    const cardToBreakDown = matches[0];
    const pointsAwarded = getBreakdownValueForRarity(cardToBreakDown.rarity);

    await users.updateOne(
      { id: userId },
      {
        $pull: { collection: { id: cardToBreakDown.id, pulledAt: cardToBreakDown.pulledAt } },
        $inc: { points: pointsAwarded },
      }
    );

    return NextResponse.json({ success: true, pointsAwarded, cardBrokenDown: cardToBreakDown.id });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to break down single card' }, { status: 500 });
  }
}
