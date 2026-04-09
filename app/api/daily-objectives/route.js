import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureDailyObjectives } from '@/lib/daily-objectives';

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
    const users = database.collection('users');
    const user = await users.findOne({ id: userId }, { projection: { id: 1, dailyObjectives: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dailyObjectives = await ensureDailyObjectives(users, user);
    return NextResponse.json({ dailyObjectives });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load daily objectives' }, { status: 500 });
  }
}
