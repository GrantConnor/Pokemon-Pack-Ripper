import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { calculateRegeneratedPoints, calculateNextPointsTime } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ authenticated: false });
    }

    const database = await connectDB();
    let user = await database.collection('users').findOne(
      { id: userId },
      {
        projection: {
          id: 1,
          username: 1,
          points: 1,
          lastPointsRefresh: 1,
          createdAt: 1,
          setAchievements: 1,
          tradesCompleted: 1,
        },
      }
    );

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const newPoints = calculateRegeneratedPoints(user);
    const nextPointsIn = calculateNextPointsTime(user);

    if (newPoints !== user.points) {
      await database.collection('users').updateOne(
        { id: userId },
        {
          $set: {
            points: newPoints,
            lastPointsRefresh: new Date().toISOString(),
          },
        }
      );
      user.points = newPoints;
      user.lastPointsRefresh = new Date().toISOString();
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        points: user.points,
        nextPointsIn,
        setAchievements: user.setAchievements || {},
        tradesCompleted: user.tradesCompleted || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: error?.message || 'Session check failed',
      transient: true,
    }, { status: 500 });
  }
}
