import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, friendId } = await request.json();
    if (!userId || !friendId) {
      return NextResponse.json({ error: 'User ID and friend ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    await Promise.all([
      users.updateOne({ id: userId }, { $addToSet: { friends: friendId }, $pull: { friendRequests: friendId } }),
      users.updateOne({ id: friendId }, { $addToSet: { friends: userId }, $pull: { sentFriendRequests: userId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to accept friend request' }, { status: 500 });
  }
}
