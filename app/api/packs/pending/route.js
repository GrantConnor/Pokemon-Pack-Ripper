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
    const reveal = await database.collection('pack_reveals').findOne(
      { userId, revealed: false },
      { sort: { createdAt: -1 } }
    );

    return NextResponse.json({ reveal: reveal || null });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch pending pack reveal' }, { status: 500 });
  }
}
