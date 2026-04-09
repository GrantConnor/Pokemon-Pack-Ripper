const DAILY_TIMEZONE = 'America/Toronto';
const DAILY_REWARD_POINTS = 500;
const TYPE_POOL = ['fire', 'water', 'grass', 'electric', 'psychic', 'dark', 'dragon', 'ghost', 'fighting', 'steel'];

function getTorontoDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function seededIndex(dateKey, modulo) {
  const hash = Array.from(String(dateKey)).reduce((sum, ch) => ((sum * 31) + ch.charCodeAt(0)) >>> 0, 7);
  return hash % modulo;
}

function buildObjectives(dateKey) {
  const featuredType = TYPE_POOL[seededIndex(dateKey, TYPE_POOL.length)];
  return [
    {
      id: `catch-type-${featuredType}`,
      label: `Catch 3 ${featuredType.charAt(0).toUpperCase() + featuredType.slice(1)}-type Pokémon`,
      type: 'catch-type',
      target: 3,
      progress: 0,
      rewardPoints: DAILY_REWARD_POINTS,
      completed: false,
      rewardGranted: false,
      meta: { pokemonType: featuredType },
    },
    {
      id: 'open-5-packs',
      label: 'Open 5 packs',
      type: 'open-pack',
      target: 5,
      progress: 0,
      rewardPoints: DAILY_REWARD_POINTS,
      completed: false,
      rewardGranted: false,
      meta: {},
    },
    {
      id: 'win-1-battle',
      label: 'Win 1 battle',
      type: 'win-battle',
      target: 1,
      progress: 0,
      rewardPoints: DAILY_REWARD_POINTS,
      completed: false,
      rewardGranted: false,
      meta: {},
    },
  ];
}

export async function ensureDailyObjectives(usersCollection, userOrId) {
  const user = typeof userOrId === 'string'
    ? await usersCollection.findOne({ id: userOrId }, { projection: { id: 1, dailyObjectives: 1 } })
    : userOrId;
  if (!user?.id) return null;

  const dateKey = getTorontoDateKey();
  const current = user.dailyObjectives;
  if (current?.dateKey === dateKey && Array.isArray(current.objectives)) {
    return current;
  }

  const nextDailyObjectives = {
    dateKey,
    objectives: buildObjectives(dateKey),
    updatedAt: new Date().toISOString(),
  };

  await usersCollection.updateOne(
    { id: user.id },
    { $set: { dailyObjectives: nextDailyObjectives } }
  );

  return nextDailyObjectives;
}

export async function applyDailyObjectiveEvent(usersCollection, userId, eventType, payload = {}) {
  const user = await usersCollection.findOne(
    { id: userId },
    { projection: { id: 1, points: 1, dailyObjectives: 1 } }
  );
  if (!user) return null;

  const dailyObjectives = await ensureDailyObjectives(usersCollection, user);
  if (!dailyObjectives) return null;

  let pointsAwarded = 0;
  let changed = false;
  const objectives = dailyObjectives.objectives.map((objective) => {
    if (!objective || objective.rewardGranted) return objective;
    let progressIncrease = 0;

    if (objective.type === 'open-pack' && eventType === 'open-pack') {
      progressIncrease = Number(payload.count || 0);
    }
    if (objective.type === 'win-battle' && eventType === 'win-battle') {
      progressIncrease = Number(payload.count || 1);
    }
    if (objective.type === 'catch-type' && eventType === 'catch-pokemon') {
      const caughtTypes = Array.isArray(payload.types) ? payload.types : [];
      if (caughtTypes.includes(objective.meta?.pokemonType)) {
        progressIncrease = Number(payload.count || 1);
      }
    }

    if (progressIncrease <= 0) return objective;

    changed = true;
    const nextProgress = Math.min(objective.target, (objective.progress || 0) + progressIncrease);
    const completed = nextProgress >= objective.target;
    const rewardGranted = completed ? true : !!objective.rewardGranted;
    if (completed && !objective.rewardGranted) {
      pointsAwarded += objective.rewardPoints || DAILY_REWARD_POINTS;
    }

    return {
      ...objective,
      progress: nextProgress,
      completed,
      rewardGranted,
    };
  });

  if (!changed) {
    return { dailyObjectives, pointsAwarded: 0 };
  }

  const nextDailyObjectives = {
    ...dailyObjectives,
    objectives,
    updatedAt: new Date().toISOString(),
  };

  await usersCollection.updateOne(
    { id: userId },
    {
      $set: { dailyObjectives: nextDailyObjectives },
      ...(pointsAwarded > 0 ? { $inc: { points: pointsAwarded } } : {}),
    }
  );

  return { dailyObjectives: nextDailyObjectives, pointsAwarded };
}
