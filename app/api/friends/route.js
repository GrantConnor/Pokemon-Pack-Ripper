import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const user = await database.collection('users').findOne(
      { id: userId },
      {
        projection: {
          friends: 1,
          friendRequests: 1,
          sentFriendRequests: 1,
          tradeRequests: 1,
          battleRequests: 1,
          activeBattleId: 1,
          username: 1,
        },
      }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const friendIds = user.friends || [];
    const requestIds = user.friendRequests || [];
    const sentIds = user.sentFriendRequests || [];

    const [friends, pendingRequests, sentRequests, outgoingTradeOwners, outgoingBattleOwners] = await Promise.all([
      friendIds.length
        ? database.collection('users').find({ id: { $in: friendIds } }).project({ id: 1, username: 1, tradesCompleted: 1, lastSeenAt: 1 }).toArray()
        : Promise.resolve([]),
      requestIds.length
        ? database.collection('users').find({ id: { $in: requestIds } }).project({ id: 1, username: 1 }).toArray()
        : Promise.resolve([]),
      sentIds.length
        ? database.collection('users').find({ id: { $in: sentIds } }).project({ id: 1, username: 1 }).toArray()
        : Promise.resolve([]),
      database.collection('users').find({ 'tradeRequests.from': userId, 'tradeRequests.status': 'pending' }).project({ id: 1, username: 1, tradeRequests: 1 }).toArray(),
      database.collection('users').find({ 'battleRequests.from.id': userId, 'battleRequests.status': 'pending' }).project({ id: 1, username: 1, battleRequests: 1 }).toArray(),
    ]);

    const outgoingTradeRequests = outgoingTradeOwners.flatMap((owner) =>
      (owner.tradeRequests || [])
        .filter((trade) => trade?.status === 'pending' && trade?.from === userId)
        .map((trade) => ({ ...trade, recipientUsername: owner.username }))
    );

    const outgoingBattleRequests = outgoingBattleOwners.flatMap((owner) =>
      (owner.battleRequests || [])
        .filter((request) => request?.status === 'pending' && request?.from?.id === userId)
        .map((request) => ({ ...request, recipientUsername: owner.username }))
    );

    const onlineThreshold = Date.now() - 60 * 1000;
    const friendsWithPresence = friends
      .map((friend) => ({
        ...friend,
        isOnline: !!friend.lastSeenAt && new Date(friend.lastSeenAt).getTime() >= onlineThreshold,
      }))
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        const aSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const bSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        if (aSeen !== bSeen) return bSeen - aSeen;
        return (a.username || '').localeCompare(b.username || '');
      });

    return NextResponse.json({
      friends: friendsWithPresence,
      pendingRequests,
      sentRequests,
      tradeRequests: user.tradeRequests || [],
      battleRequests: user.battleRequests || [],
      outgoingTradeRequests,
      outgoingBattleRequests,
      activeBattleId: user.activeBattleId || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load friends' }, { status: 500 });
  }
}
