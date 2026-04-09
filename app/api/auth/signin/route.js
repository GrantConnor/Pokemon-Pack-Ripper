import { NextResponse } from 'next/server';
import { connectDB, getSanitizedMongoConfig } from '@/lib/mongodb';
import { normalizeUsername, escapeRegex, verifyPassword, hashPassword, getPointRegenState, refreshAllUsersPointsIfDue, makeAuthTraceId } from '@/lib/auth';

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
    await refreshAllUsersPointsIfDue(db);
    const users = db.collection('users');

    let user = await users.findOne(
      { normalizedUsername },
      {
        projection: {
          id: 1,
          username: 1,
          normalizedUsername: 1,
          password: 1,
          points: 1,
          lastPointsRefresh: 1,
          createdAt: 1,
          setAchievements: 1,
          tradesCompleted: 1,
          battleWins: 1,
        },
      }
    );
    if (!user) {
      user = await users.findOne(
        { username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') } },
        {
          projection: {
            id: 1,
            username: 1,
            normalizedUsername: 1,
            password: 1,
            points: 1,
            lastPointsRefresh: 1,
            createdAt: 1,
            setAchievements: 1,
            tradesCompleted: 1,
            battleWins: 1,
          battleWins: 1,
          },
        }
      );

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

    const regen = getPointRegenState(user);

    if (regen.points !== user.points || regen.lastPointsRefresh !== (user.lastPointsRefresh || user.createdAt)) {
      await users.updateOne(
        { _id: user._id },
        { $set: { points: regen.points, lastPointsRefresh: regen.lastPointsRefresh } }
      );
      user.points = regen.points;
      user.lastPointsRefresh = regen.lastPointsRefresh;
    }

    return NextResponse.json({
      success: true,
      authTraceId,
      user: {
        id: resolvedUserId,
        username: user.username,
        points: user.points,
        nextPointsIn: regen.nextPointsIn,
        setAchievements: user.setAchievements || {},
        tradesCompleted: user.tradesCompleted || 0,
        battleWins: user.battleWins || 0,
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
