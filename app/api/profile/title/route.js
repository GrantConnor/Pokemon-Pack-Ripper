import { getAllAvailableTitles, mergeSpecialTitlesForUsername } from '@/lib/set-titles';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, titleId } = await request.json();
    if (!userId || !titleId) {
      return NextResponse.json({ error: 'User ID and title ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const user = await database.collection('users').findOne(
      { id: userId },
      { projection: { id: 1, username: 1, unlockedTitles: 1, battleWins: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const computedUnlockedTitles = mergeSpecialTitlesForUsername(user.username, user.unlockedTitles || []);
    if (JSON.stringify(computedUnlockedTitles) !== JSON.stringify(user.unlockedTitles || [])) {
      await database.collection('users').updateOne({ id: userId }, { $set: { unlockedTitles: computedUnlockedTitles } });
    }
    user.unlockedTitles = computedUnlockedTitles;

    const ownedTitle = getAllAvailableTitles({ battleWins: user.battleWins || 0, unlockedTitles: user.unlockedTitles || [] }).find((title) => title?.id === titleId);
    if (!ownedTitle) {
      return NextResponse.json({ error: 'Title is not unlocked for this user' }, { status: 400 });
    }

    await database.collection('users').updateOne(
      { id: userId },
      { $set: { selectedTitleId: titleId } }
    );

    return NextResponse.json({ success: true, selectedTitleId: titleId, selectedTitle: ownedTitle });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to update title' }, { status: 500 });
  }
}
