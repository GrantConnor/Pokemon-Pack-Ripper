import { getAllAvailableTitles, mergeAllSetTitles } from '@/lib/set-titles';
import { getSets } from '@/lib/pokemon-tcg';
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

    if (user.username === 'Spheal') {
      const allTitles = mergeAllSetTitles(user.unlockedTitles || [], (await getSets()).sets || []);
      if (allTitles.length !== (user.unlockedTitles || []).length) {
        await database.collection('users').updateOne({ id: userId }, { $set: { unlockedTitles: allTitles } });
        user.unlockedTitles = allTitles;
      }
    }

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
