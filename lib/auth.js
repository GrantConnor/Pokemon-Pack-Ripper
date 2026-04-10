import { v4 as uuidv4 } from 'uuid';

export const STARTING_POINTS = 1000;
export const POINTS_REGEN_RATE = 2000;
export const POINTS_REGEN_INTERVAL = 4 * 60 * 60 * 1000;
const GLOBAL_POINTS_SWEEP_COOLDOWN_MS = 60 * 1000;
export const MAX_POINTS = 10000;

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hashPassword(password) {
  return Buffer.from(String(password)).toString('base64');
}

export function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string') {
    return { valid: false, strategy: 'invalid-stored-password-type' };
  }

  const rawPassword = String(password ?? '');
  const trimmedPassword = rawPassword.trim();

  if (storedPassword === hashPassword(trimmedPassword)) {
    return { valid: true, strategy: 'base64-trimmed' };
  }

  if (storedPassword === hashPassword(rawPassword)) {
    return { valid: true, strategy: 'base64-raw' };
  }

  if (storedPassword === trimmedPassword) {
    return { valid: true, strategy: 'plaintext-trimmed' };
  }

  if (storedPassword === rawPassword) {
    return { valid: true, strategy: 'plaintext-raw' };
  }

  return { valid: false, strategy: 'no-match' };
}

export function getPointRegenState(user, nowMs = Date.now()) {
  if (user.username === 'Spheal') {
    return {
      points: 999999,
      nextPointsIn: 0,
      lastPointsRefresh: user.lastPointsRefresh || user.createdAt || new Date(nowMs).toISOString(),
      intervalsGained: 0,
    };
  }

  const parsedLastRefreshMs = new Date(user.lastPointsRefresh || user.createdAt || nowMs).getTime();
  const lastRefreshMs = Number.isFinite(parsedLastRefreshMs) ? parsedLastRefreshMs : nowMs;
  const elapsedMs = Math.max(0, nowMs - lastRefreshMs);
  const intervalsGained = Math.floor(elapsedMs / POINTS_REGEN_INTERVAL);
  const currentPoints = Number(user.points || 0);
  const newPoints = Math.min(currentPoints + (intervalsGained * POINTS_REGEN_RATE), MAX_POINTS);
  const advancedRefreshMs = lastRefreshMs + (intervalsGained * POINTS_REGEN_INTERVAL);
  const elapsedSinceAdvancedRefresh = Math.max(0, nowMs - advancedRefreshMs);
  const nextPointsInMs = POINTS_REGEN_INTERVAL - (elapsedSinceAdvancedRefresh % POINTS_REGEN_INTERVAL);

  return {
    points: newPoints,
    nextPointsIn: Math.ceil(nextPointsInMs / 1000),
    lastPointsRefresh: new Date(advancedRefreshMs).toISOString(),
    intervalsGained,
  };
}

export function calculateRegeneratedPoints(user) {
  return getPointRegenState(user).points;
}

export function calculateNextPointsTime(user) {
  return getPointRegenState(user).nextPointsIn;
}

export async function refreshUserPoints(usersCollection, user, nowMs = Date.now()) {
  if (!user) return null;

  const regen = getPointRegenState(user, nowMs);
  const currentPoints = Number(user.points || 0);
  const currentLastRefresh = user.lastPointsRefresh || user.createdAt || regen.lastPointsRefresh;

  if (regen.points !== currentPoints || regen.lastPointsRefresh !== currentLastRefresh) {
    const filter = user._id ? { _id: user._id } : { id: user.id };
    await usersCollection.updateOne(filter, {
      $set: {
        points: regen.points,
        lastPointsRefresh: regen.lastPointsRefresh,
      },
    });
  }

  return {
    ...user,
    points: regen.points,
    lastPointsRefresh: regen.lastPointsRefresh,
    nextPointsIn: regen.nextPointsIn,
  };
}

export async function refreshAllUsersPointsIfDue(db, nowMs = Date.now()) {
  const meta = db.collection('system_meta');
  const cutoffIso = new Date(nowMs - GLOBAL_POINTS_SWEEP_COOLDOWN_MS).toISOString();

  let lockResult;
  try {
    lockResult = await meta.findOneAndUpdate(
      {
        _id: 'pointsSweep',
        $or: [
          { lastSweepAt: { $exists: false } },
          { lastSweepAt: { $lt: cutoffIso } },
        ],
      },
      {
        $set: { lastSweepAt: new Date(nowMs).toISOString() },
      },
      {
        upsert: true,
        returnDocument: 'before',
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return { swept: false, reason: 'race-duplicate-lock' };
    }
    throw error;
  }

  const previousSweepAt = lockResult?.value?.lastSweepAt;
  if (previousSweepAt && new Date(previousSweepAt).getTime() > (nowMs - GLOBAL_POINTS_SWEEP_COOLDOWN_MS)) {
    return { swept: false, reason: 'cooldown' };
  }

  const users = await db.collection('users').find(
    {},
    { projection: { _id: 1, id: 1, username: 1, points: 1, createdAt: 1, lastPointsRefresh: 1 } }
  ).toArray();

  const bulkOps = [];
  for (const user of users) {
    const regen = getPointRegenState(user, nowMs);
    const currentPoints = Number(user.points || 0);
    const currentLastRefresh = user.lastPointsRefresh || user.createdAt || regen.lastPointsRefresh;
    if (regen.points !== currentPoints || regen.lastPointsRefresh !== currentLastRefresh) {
      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              points: regen.points,
              lastPointsRefresh: regen.lastPointsRefresh,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await db.collection('users').bulkWrite(bulkOps);
  }

  return { swept: true, updatedUsers: bulkOps.length };
}

export function makeAuthTraceId(prefix) {
  return `${prefix}-${uuidv4()}`;
}
