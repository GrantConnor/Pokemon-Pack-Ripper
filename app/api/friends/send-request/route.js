import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, targetUsername } = await request.json();
    if (!userId || !targetUsername) {
      return NextResponse.json({ error: 'User ID and target username required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const [user, targetUser] = await Promise.all([
      users.findOne({ id: userId }, { projection: { id: 1, username: 1, friends: 1 } }),
      users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(targetUsername)}$`, 'i') } }, { projection: { id: 1, username: 1, friendRequests: 1 } }),
    ]);

    if (!user || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.id === targetUser.id) {
      return NextResponse.json({ error: 'Cannot add yourself as friend' }, { status: 400 });
    }
    if (user.friends?.includes(targetUser.id)) {
      return NextResponse.json({ error: 'Already friends' }, { status: 400 });
    }
    if (targetUser.friendRequests?.includes(user.id)) {
      return NextResponse.json({ error: 'Friend request already sent' }, { status: 400 });
    }

    await Promise.all([
      users.updateOne({ id: targetUser.id }, { $addToSet: { friendRequests: user.id } }),
      users.updateOne({ id: user.id }, { $addToSet: { sentFriendRequests: targetUser.id } }),
    ]);

    return NextResponse.json({ success: true, message: `Friend request sent to ${targetUser.username}` });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to send friend request' }, { status: 500 });
  }
}
