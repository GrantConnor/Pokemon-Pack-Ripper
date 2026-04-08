import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, friendId } = await request.json();
    if (!userId || !friendId) {
      return NextResponse.json({ error: 'User ID and Friend ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');

    await Promise.all([
      users.updateOne({ id: userId }, { $pull: { friends: friendId } }),
      users.updateOne({ id: friendId }, { $pull: { friends: userId } }),
    ]);

    return NextResponse.json({ success: true, message: 'Friend removed' });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to remove friend' }, { status: 500 });
  }
}
