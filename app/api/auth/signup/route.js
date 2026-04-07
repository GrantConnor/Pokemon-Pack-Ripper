import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB, getSanitizedMongoConfig } from '@/lib/mongodb';
import { normalizeUsername, escapeRegex, hashPassword, calculateNextPointsTime, STARTING_POINTS, makeAuthTraceId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authTraceId = makeAuthTraceId('signup');

  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
    }

    const trimmedUsername = String(username).trim();
    const trimmedPassword = String(password).trim();
    const normalizedUsername = normalizeUsername(trimmedUsername);

    if (!trimmedUsername || !trimmedPassword) {
      return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
    }

    const db = await connectDB();
    const users = db.collection('users');

    const existingUser = await users.findOne(
      { normalizedUsername },
      { projection: { _id: 1, id: 1, username: 1, normalizedUsername: 1 } }
    );
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists', authTraceId }, { status: 409 });
    }

    const legacyMatch = await users.findOne(
      { username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') } },
      { projection: { _id: 1, id: 1, username: 1, normalizedUsername: 1 } }
    );
    if (legacyMatch) {
      return NextResponse.json({ error: 'Username already exists', authTraceId }, { status: 409 });
    }

    const newUser = {
      id: uuidv4(),
      username: trimmedUsername,
      normalizedUsername,
      password: hashPassword(trimmedPassword),
      collection: [],
      setAchievements: {},
      friends: [],
      friendRequests: [],
      sentFriendRequests: [],
      tradeRequests: [],
      tradesCompleted: 0,
      points: trimmedUsername === 'Spheal' ? 999999 : STARTING_POINTS,
      lastPointsRefresh: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await users.insertOne(newUser);

    return NextResponse.json({
      success: true,
      authTraceId,
      user: {
        id: newUser.id,
        username: newUser.username,
        points: newUser.points,
        nextPointsIn: calculateNextPointsTime(newUser),
        setAchievements: newUser.setAchievements || {}
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error?.message || 'Signup failed',
      authTraceId,
      config: getSanitizedMongoConfig(),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
