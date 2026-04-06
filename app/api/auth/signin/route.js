import { NextResponse } from 'next/server';
import { connectDB, getSanitizedMongoConfig } from '@/lib/mongodb';
import { normalizeUsername, escapeRegex, verifyPassword, hashPassword, calculateRegeneratedPoints, calculateNextPointsTime, makeAuthTraceId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authTraceId = makeAuthTraceId('signin');

  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
    }

    const trimmedUsername = String(username).trim();
    const rawPassword = String(password);
    const trimmedPassword = rawPassword.trim();
    const normalizedUsername = normalizeUsername(trimmedUsername);

    if (!trimmedUsername || !trimmedPassword) {
      return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
    }

    const db = await connectDB();
    const users = db.collection('users');

    let user = await users.findOne({ normalizedUsername });
    if (!user) {
      user = await users.findOne({
        username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') }
      });

      if (user && !user.normalizedUsername) {
        await users.updateOne(
          { _id: user._id },
          { $set: { normalizedUsername: normalizeUsername(user.username) } }
        );
        user.normalizedUsername = normalizeUsername(user.username);
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials', authTraceId }, { status: 401 });
    }

    const passwordCheck = verifyPassword(rawPassword, user.password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: 'Invalid credentials', authTraceId, passwordStrategy: passwordCheck.strategy }, { status: 401 });
    }

    if (passwordCheck.strategy.startsWith('plaintext')) {
      const migratedPassword = hashPassword(trimmedPassword);
      await users.updateOne({ _id: user._id }, { $set: { password: migratedPassword } });
      user.password = migratedPassword;
    }

    const resolvedUserId = user.id || String(user._id);
    if (!user.id) {
      await users.updateOne({ _id: user._id }, { $set: { id: resolvedUserId } });
      user.id = resolvedUserId;
    }

    const newPoints = calculateRegeneratedPoints(user);
    const nextPointsIn = calculateNextPointsTime(user);

    if (newPoints !== user.points) {
      await users.updateOne(
        { _id: user._id },
        { $set: { points: newPoints, lastPointsRefresh: new Date().toISOString() } }
      );
      user.points = newPoints;
    }

    return NextResponse.json({
      success: true,
      authTraceId,
      user: {
        id: resolvedUserId,
        username: user.username,
        points: user.points,
        nextPointsIn,
        setAchievements: user.setAchievements || {},
        tradesCompleted: user.tradesCompleted || 0,
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error?.message || 'Signin failed',
      authTraceId,
      config: getSanitizedMongoConfig(),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
