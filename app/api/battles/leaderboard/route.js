import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getTrainerRank } from '@/lib/trainer-ranks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 50);
    const database = await connectDB();
    const users = await database.collection('users')
      .find({}, { projection: { id: 1, username: 1, battleWins: 1, points: 1 } })
      .sort({ battleWins: -1, username: 1 })
      .limit(limit)
      .toArray();

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      username: user.username,
      battleWins: user.battleWins || 0,
      points: user.points || 0,
      trainerRank: getTrainerRank(user.battleWins || 0),
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load leaderboard' }, { status: 500 });
  }
}
