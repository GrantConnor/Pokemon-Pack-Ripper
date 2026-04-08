const fs = require('fs');
const path = require('path');
const assert = require('assert');

const authSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'auth.js'), 'utf8');
const start = authSrc.indexOf('export const STARTING_POINTS');
const end = authSrc.indexOf('export function makeAuthTraceId');
let js = authSrc.slice(start, end)
  .replace(/export\s+/g, '');
const api = new Function(`${js}; return { STARTING_POINTS, POINTS_REGEN_RATE, POINTS_REGEN_INTERVAL, MAX_POINTS, getPointRegenState, refreshUserPoints, refreshAllUsersPointsIfDue };`)();
const { POINTS_REGEN_INTERVAL, MAX_POINTS, getPointRegenState, refreshUserPoints, refreshAllUsersPointsIfDue } = api;

class FakeUsersCollection {
  constructor(users) { this.users = users; this.bulkWrites = []; }
  find() { return { toArray: async () => this.users.map(u => ({ ...u })) }; }
  async updateOne(filter, update) {
    const key = filter._id ? '_id' : 'id';
    const user = this.users.find(u => u[key] === filter[key]);
    if (!user) throw new Error('User not found in fake collection');
    if (update.$set) Object.assign(user, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async bulkWrite(ops) {
    this.bulkWrites.push(...ops);
    for (const op of ops) {
      await this.updateOne(op.updateOne.filter, op.updateOne.update);
    }
    return { modifiedCount: ops.length };
  }
}

class FakeMetaCollection {
  constructor() { this.doc = null; }
  async findOneAndUpdate(filter, update, opts) {
    const current = this.doc ? { ...this.doc } : null;
    const cutoff = filter.$or?.[1]?.lastSweepAt?.$lt;
    const matches = !current || !current.lastSweepAt || current.lastSweepAt < cutoff;
    if (!matches) return { value: current };
    this.doc = { _id: 'pointsSweep', ...update.$set };
    return { value: current };
  }
}

class FakeDb {
  constructor(users) {
    this.usersCollection = new FakeUsersCollection(users);
    this.metaCollection = new FakeMetaCollection();
  }
  collection(name) {
    if (name === 'users') return this.usersCollection;
    if (name === 'system_meta') return this.metaCollection;
    throw new Error(`Unknown collection ${name}`);
  }
}

(async () => {
  const now = Date.parse('2026-04-08T18:00:00.000Z');

  const sixHoursAgo = new Date(now - (3 * POINTS_REGEN_INTERVAL)).toISOString();
  const state = getPointRegenState({ username: 'Ash', points: 1000, lastPointsRefresh: sixHoursAgo }, now);
  assert.equal(state.points, 4000, 'offline user should gain 3000 points after 6 hours');

  const capped = getPointRegenState({ username: 'Misty', points: 9500, lastPointsRefresh: sixHoursAgo }, now);
  assert.equal(capped.points, MAX_POINTS, 'points should cap at MAX_POINTS');

  const spheal = getPointRegenState({ username: 'Spheal', points: 1, lastPointsRefresh: sixHoursAgo }, now);
  assert.equal(spheal.points, 999999, 'Spheal should stay uncapped');

  const db = new FakeDb([
    { _id: 1, id: 'u1', username: 'Ash', points: 1000, lastPointsRefresh: sixHoursAgo, createdAt: sixHoursAgo },
    { _id: 2, id: 'u2', username: 'Misty', points: 9500, lastPointsRefresh: sixHoursAgo, createdAt: sixHoursAgo },
    { _id: 3, id: 'u3', username: 'Spheal', points: 999999, lastPointsRefresh: sixHoursAgo, createdAt: sixHoursAgo },
  ]);

  const sweep = await refreshAllUsersPointsIfDue(db, now);
  assert.equal(sweep.swept, true, 'global sweep should run');
  assert.equal(db.usersCollection.users[0].points, 4000, 'sweep should update offline user');
  assert.equal(db.usersCollection.users[1].points, MAX_POINTS, 'sweep should cap points');
  assert.equal(db.usersCollection.users[2].points, 999999, 'sweep should preserve Spheal');

  const cooldownSweep = await refreshAllUsersPointsIfDue(db, now + 30_000);
  assert.equal(cooldownSweep.swept, false, 'second sweep inside cooldown should skip');

  db.usersCollection.users.push({
    _id: 4,
    id: 'u4',
    username: 'Brock',
    points: 2000,
    lastPointsRefresh: new Date(now - POINTS_REGEN_INTERVAL).toISOString(),
    createdAt: new Date(now - POINTS_REGEN_INTERVAL).toISOString(),
  });

  const refreshed = await refreshUserPoints(db.collection('users'), db.usersCollection.users[3], now);
  assert.equal(refreshed.points, 3000, 'per-user refresh should grant one interval');

  const scheduledFn = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'points-sweep.js'), 'utf8');
  assert(scheduledFn.includes("schedule: '*/5 * * * *'"), 'scheduled function should run every 5 minutes');

  const report = {
    status: 'passed',
    checked: [
      'offline accrual every 2 hours',
      'max points cap enforcement',
      'Spheal exemption',
      'global sweep updates all users',
      'global sweep cooldown lock',
      'per-user refresh before mutations',
      'scheduled Netlify sweep presence',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
})();
