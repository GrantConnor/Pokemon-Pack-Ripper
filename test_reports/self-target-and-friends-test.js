function inferStatTarget(move) {
  const text = `${move.effectEntries || ''}`.toLowerCase();
  if (text.includes('target') || text.includes('opposing') || text.includes('enemy')) return 'target';
  if (text.includes('user') || text.includes("the user's") || text.includes('the user')) return 'self';
  const netChange = (move.statChanges || []).reduce((sum, change) => sum + change.change, 0);
  return netChange < 0 ? 'target' : 'self';
}

function getMoveTargetMode(move) {
  const target = move?.target || '';
  if (['user', 'user-or-ally'].includes(target)) return 'self';
  if (['users-field'].includes(target)) return 'self-side';
  if (['opponents-field'].includes(target)) return 'opponent-side';
  if (['entire-field'].includes(target)) return 'field';
  return 'target';
}

function resolveStatChangeRecipient(move) {
  const baseTargetMode = getMoveTargetMode(move);
  const inferredTargetMode = inferStatTarget(move);
  const targetMode = baseTargetMode === 'self' ? 'self' : inferredTargetMode;
  return targetMode === 'target' ? 'opponent' : 'self';
}

function sortFriendsByOnline(friends = []) {
  return [...friends].sort((a, b) => {
    if (!!a?.isOnline !== !!b?.isOnline) return a?.isOnline ? -1 : 1;
    const aSeen = a?.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bSeen = b?.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    if (aSeen !== bSeen) return bSeen - aSeen;
    return (a?.username || '').localeCompare(b?.username || '');
  });
}

const moveCases = [
  {
    name: 'swords-dance',
    target: 'user',
    effectEntries: "Raises the user's Attack by two stages.",
    statChanges: [{ stat: 'attack', change: 2 }],
    expectedRecipient: 'self',
  },
  {
    name: 'close-combat',
    target: 'selected-pokemon',
    effectEntries: "Inflicts regular damage.  Raises the user's Attack by no stages. Lowers the user's Defense and Special Defense by one stage.",
    statChanges: [
      { stat: 'defense', change: -1 },
      { stat: 'special-defense', change: -1 },
    ],
    expectedRecipient: 'self',
  },
  {
    name: 'superpower',
    target: 'selected-pokemon',
    effectEntries: "Inflicts regular damage, then lowers the user's Attack and Defense by one stage.",
    statChanges: [
      { stat: 'attack', change: -1 },
      { stat: 'defense', change: -1 },
    ],
    expectedRecipient: 'self',
  },
  {
    name: 'metal-claw',
    target: 'selected-pokemon',
    effectEntries: "Inflicts regular damage. Has a 10% chance to raise the user's Attack by one stage.",
    statChanges: [{ stat: 'attack', change: 1 }],
    expectedRecipient: 'self',
  },
  {
    name: 'ancient-power',
    target: 'selected-pokemon',
    effectEntries: "Inflicts regular damage. Has a 10% chance to raise all of the user's stats by one stage.",
    statChanges: [
      { stat: 'attack', change: 1 },
      { stat: 'defense', change: 1 },
      { stat: 'special-attack', change: 1 },
      { stat: 'special-defense', change: 1 },
      { stat: 'speed', change: 1 },
    ],
    expectedRecipient: 'self',
  },
  {
    name: 'tail-whip',
    target: 'selected-pokemon',
    effectEntries: "Lowers the target's Defense by one stage.",
    statChanges: [{ stat: 'defense', change: -1 }],
    expectedRecipient: 'opponent',
  },
  {
    name: 'growl',
    target: 'all-opponents',
    effectEntries: "Lowers the target's Attack by one stage.",
    statChanges: [{ stat: 'attack', change: -1 }],
    expectedRecipient: 'opponent',
  },
  {
    name: 'nasty-plot',
    target: 'user',
    effectEntries: "Raises the user's Special Attack by two stages.",
    statChanges: [{ stat: 'special-attack', change: 2 }],
    expectedRecipient: 'self',
  },
  {
    name: 'charm',
    target: 'selected-pokemon',
    effectEntries: "Lowers the target's Attack by two stages.",
    statChanges: [{ stat: 'attack', change: -2 }],
    expectedRecipient: 'opponent',
  },
];

const moveResults = moveCases.map((move) => ({
  name: move.name,
  target: move.target,
  resolvedRecipient: resolveStatChangeRecipient(move),
  expectedRecipient: move.expectedRecipient,
  passed: resolveStatChangeRecipient(move) === move.expectedRecipient,
}));

const friendSample = [
  { username: 'Zed', isOnline: false, lastSeenAt: '2026-04-08T10:00:00.000Z' },
  { username: 'Ash', isOnline: true, lastSeenAt: '2026-04-08T11:58:00.000Z' },
  { username: 'Misty', isOnline: true, lastSeenAt: '2026-04-08T11:59:00.000Z' },
  { username: 'Brock', isOnline: false, lastSeenAt: '2026-04-08T11:30:00.000Z' },
];
const sortedFriends = sortFriendsByOnline(friendSample).map((f) => f.username);
const friendSortPassed = JSON.stringify(sortedFriends) === JSON.stringify(['Misty', 'Ash', 'Brock', 'Zed']);

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    moveCasesTested: moveResults.length,
    moveCasesPassed: moveResults.filter((r) => r.passed).length,
    moveCasesFailed: moveResults.filter((r) => !r.passed).length,
    friendSortPassed,
  },
  moveResults,
  friendSorting: {
    inputOrder: friendSample.map((f) => f.username),
    sortedOrder: sortedFriends,
    expectedOrder: ['Misty', 'Ash', 'Brock', 'Zed'],
    passed: friendSortPassed,
  },
};

console.log(JSON.stringify(report, null, 2));
