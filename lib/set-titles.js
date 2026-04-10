import { getTrainerRank, TRAINER_RANKS } from '@/lib/trainer-ranks';

const TITLE_PALETTES = [
  { textClass: 'text-cyan-300', badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' },
  { textClass: 'text-emerald-300', badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  { textClass: 'text-fuchsia-300', badgeClass: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40' },
  { textClass: 'text-amber-300', badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  { textClass: 'text-violet-300', badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-400/40' },
  { textClass: 'text-rose-300', badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
  { textClass: 'text-sky-300', badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/40' },
  { textClass: 'text-lime-300', badgeClass: 'bg-lime-500/20 text-lime-200 border-lime-400/40' },
];

const TITLE_PREFIXES = [
  'Astral', 'Blazing', 'Celestial', 'Crimson', 'Shadow', 'Storm', 'Luminous', 'Arcane',
  'Radiant', 'Iron', 'Mystic', 'Solar', 'Lunar', 'Glacial', 'Ember', 'Abyssal',
  'Royal', 'Primal', 'Volt', 'Tidal', 'Verdant', 'Obsidian', 'Aurora', 'Phoenix',
  'Dragon', 'Titan', 'Eternal', 'Cosmic', 'Zenith', 'Mirage', 'Starlit', 'Inferno',
];

const TITLE_SUFFIXES = [
  'Warden', 'Oracle', 'Vanguard', 'Sovereign', 'Sentinel', 'Champion', 'Marshal', 'Keeper',
  'Harbinger', 'Seeker', 'Caller', 'Binder', 'Knight', 'Monarch', 'Sage', 'Corsair',
  'Strider', 'Tactician', 'Arbiter', 'Ascendant', 'Guardian', 'Forgeborn', 'Conqueror', 'Drifter',
  'Executor', 'Invoker', 'Wayfinder', 'Starborn', 'Renegade', 'Archon', 'Virtuoso', 'Overlord',
];

function seededHash(value = '') {
  return Array.from(String(value)).reduce((sum, ch) => ((sum * 33) + ch.charCodeAt(0)) >>> 0, 17);
}

function seededPalette(setId = '') {
  return TITLE_PALETTES[seededHash(setId) % TITLE_PALETTES.length];
}

function fallbackThemeWord(setId = '', setName = '') {
  const hash = seededHash(`${setId}:${setName}`);
  const prefix = TITLE_PREFIXES[hash % TITLE_PREFIXES.length];
  const suffix = TITLE_SUFFIXES[Math.floor(hash / TITLE_PREFIXES.length) % TITLE_SUFFIXES.length];
  return `${prefix} ${suffix}`;
}

function getThemeWord(setId = '', setName = '') {
  const name = `${setId} ${setName}`.toLowerCase();
  if (name.includes('base')) return 'Pioneer';
  if (name.includes('jungle')) return 'Jungle Warden';
  if (name.includes('fossil')) return 'Relic Seeker';
  if (name.includes('gym')) return 'Badge Master';
  if (name.includes('neo')) return 'Neo Ascendant';
  if (name.includes('legendary')) return 'Legend Keeper';
  if (name.includes('expedition')) return 'Pathfinder';
  if (name.includes('aquapolis')) return 'Tide Sovereign';
  if (name.includes('sky ridge')) return 'Sky Oracle';
  if (name.includes('ruby') || name.includes('sapphire')) return 'Hoenn Vanguard';
  if (name.includes('sandstorm')) return 'Dune Caller';
  if (name.includes('dragon')) return 'Drakebound';
  if (name.includes('magma') || name.includes('aqua')) return 'Elemental Commander';
  if (name.includes('hidden legends')) return 'Hidden Legend';
  if (name.includes('rocket')) return 'Rocket Renegade';
  if (name.includes('deoxys')) return 'Cosmic Cipher';
  if (name.includes('emerald')) return 'Emerald Warden';
  if (name.includes('unseen')) return 'Phantom Tracker';
  if (name.includes('delta')) return 'Delta Savant';
  if (name.includes('legend maker')) return 'Mythforger';
  return fallbackThemeWord(setId, setName);
}

export function buildSetTitles(setId, setName) {
  const palette = seededPalette(setId);
  const themeWord = getThemeWord(setId, setName);
  return [
    {
      id: `set-full-${setId}`,
      setId,
      tier: 'full',
      source: 'set',
      label: themeWord,
      description: `Unlocked by completing the numbered set for ${setName}.`,
      ...palette,
    },
    {
      id: `set-master-${setId}`,
      setId,
      tier: 'master',
      source: 'set',
      label: `${themeWord} Supreme`,
      description: `Unlocked by completing the master set for ${setName}.`,
      textClass: 'text-yellow-300',
      badgeClass: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40',
    },
  ];
}

function parseCardNumber(card) {
  const value = String(card?.number || '');
  const match = value.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

export function evaluateSetCompletion(userCollection = [], allCards = [], setId) {
  const setCards = allCards.filter((card) => card?.set?.id === setId || !setId);
  const totalCards = setCards.length;
  const printedTotal = setCards[0]?.set?.printedTotal || 0;
  const collectedSetCards = userCollection.filter((card) => card?.set?.id === setId);
  const uniqueIds = new Set(collectedSetCards.map((card) => card.id));

  const numberedIds = new Set(
    setCards
      .filter((card) => {
        const parsed = parseCardNumber(card);
        return parsed !== null && printedTotal && parsed <= printedTotal;
      })
      .map((card) => card.id)
  );

  let fullSetCompleted = false;
  if (numberedIds.size > 0) {
    fullSetCompleted = Array.from(numberedIds).every((id) => uniqueIds.has(id));
  } else {
    fullSetCompleted = uniqueIds.size >= totalCards && totalCards > 0;
  }

  const masterSetCompleted = totalCards > 0 && uniqueIds.size >= totalCards;

  return {
    fullSetCompleted,
    masterSetCompleted,
    uniqueCount: uniqueIds.size,
    totalCards,
    printedTotal,
  };
}

export async function unlockSetTitlesForUser(usersCollection, userId, setId, setName, allCards) {
  const user = await usersCollection.findOne(
    { id: userId },
    { projection: { id: 1, collection: 1, unlockedTitles: 1, selectedTitleId: 1, battleWins: 1 } }
  );
  if (!user) return { unlockedTitles: [], newlyUnlocked: [] };

  const completion = evaluateSetCompletion(user.collection || [], allCards, setId);
  const setTitles = buildSetTitles(setId, setName);
  const unlockedMap = new Map((user.unlockedTitles || []).map((title) => [title.id, title]));
  const newlyUnlocked = [];

  if (completion.fullSetCompleted && !unlockedMap.has(`set-full-${setId}`)) {
    const title = setTitles.find((item) => item.id === `set-full-${setId}`);
    unlockedMap.set(title.id, title);
    newlyUnlocked.push(title);
  }
  if (completion.masterSetCompleted && !unlockedMap.has(`set-master-${setId}`)) {
    const title = setTitles.find((item) => item.id === `set-master-${setId}`);
    unlockedMap.set(title.id, title);
    newlyUnlocked.push(title);
  }

  if (newlyUnlocked.length) {
    const unlockedTitles = Array.from(unlockedMap.values());
    const update = { unlockedTitles };
    if (!user.selectedTitleId) {
      update.selectedTitleId = `rank-${slugifyTitleLabel(getTrainerRank(user.battleWins || 0).label)}`;
    }
    await usersCollection.updateOne({ id: userId }, { $set: update });
    return { unlockedTitles, newlyUnlocked };
  }

  return { unlockedTitles: Array.from(unlockedMap.values()), newlyUnlocked: [] };
}


export function syncSetTitlesFromCollection(user = {}, setCatalog = [], cardsBySet = {}) {
  const collection = Array.isArray(user?.collection) ? user.collection : [];
  const unlockedMap = new Map((user?.unlockedTitles || []).filter((title) => title?.id).map((title) => [title.id, title]));
  const grouped = new Map();
  const setCatalogMap = new Map((setCatalog || []).filter((set) => set?.id).map((set) => [set.id, set]));

  for (const card of collection) {
    const setId = card?.set?.id;
    if (!setId) continue;
    if (!grouped.has(setId)) {
      const catalogSet = setCatalogMap.get(setId);
      grouped.set(setId, {
        setId,
        setName: card?.set?.name || catalogSet?.name || setId,
        printedTotal: Number(catalogSet?.printedTotal || card?.set?.printedTotal || 0),
        total: Number(catalogSet?.total || card?.set?.total || 0),
        uniqueIds: new Set(),
        numberedIds: new Set(),
      });
    }

    const group = grouped.get(setId);
    if (card?.id) group.uniqueIds.add(card.id);
    const parsed = parseCardNumber(card);
    if (parsed !== null && card?.id) {
      const threshold = group.printedTotal || Number(card?.set?.printedTotal || 0);
      if (!threshold || parsed <= threshold) {
        group.numberedIds.add(card.id);
      }
    }
  }

  const newlyUnlocked = [];
  for (const group of grouped.values()) {
    const authoritativeCards = Array.isArray(cardsBySet?.[group.setId]) ? cardsBySet[group.setId] : [];
    const authoritativeTotal = authoritativeCards.length || group.total;
    const authoritativePrintedTotal = Number(authoritativeCards?.[0]?.set?.printedTotal || group.printedTotal || 0);
    const authoritativeNumberedIds = new Set(
      authoritativeCards
        .filter((card) => {
          const parsed = parseCardNumber(card);
          return parsed !== null && (!authoritativePrintedTotal || parsed <= authoritativePrintedTotal);
        })
        .map((card) => card.id)
    );

    const setTitles = buildSetTitles(group.setId, group.setName);

    let fullSetCompleted = false;
    if (authoritativeNumberedIds.size > 0) {
      fullSetCompleted = Array.from(authoritativeNumberedIds).every((id) => group.uniqueIds.has(id));
    } else if (authoritativePrintedTotal > 0) {
      fullSetCompleted = group.numberedIds.size >= authoritativePrintedTotal;
    } else if (authoritativeTotal > 0) {
      fullSetCompleted = group.uniqueIds.size >= authoritativeTotal;
    }

    const masterSetCompleted = authoritativeTotal > 0 && group.uniqueIds.size >= authoritativeTotal;

    if (fullSetCompleted && !unlockedMap.has(`set-full-${group.setId}`)) {
      const title = setTitles.find((item) => item.id === `set-full-${group.setId}`);
      if (title) {
        unlockedMap.set(title.id, title);
        newlyUnlocked.push(title);
      }
    }

    if (masterSetCompleted && !unlockedMap.has(`set-master-${group.setId}`)) {
      const title = setTitles.find((item) => item.id === `set-master-${group.setId}`);
      if (title) {
        unlockedMap.set(title.id, title);
        newlyUnlocked.push(title);
      }
    }
  }

  return {
    unlockedTitles: Array.from(unlockedMap.values()),
    newlyUnlocked,
  };
}

export function slugifyTitleLabel(label = '') {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildBattleRankTitles(battleWins = 0) {
  const wins = Number.isFinite(Number(battleWins)) ? Number(battleWins) : 0;
  return TRAINER_RANKS.slice().reverse()
    .filter((rank) => wins >= rank.minWins)
    .map((rank) => ({
      id: `rank-${slugifyTitleLabel(rank.label)}`,
      source: 'battle-rank',
      tier: 'rank',
      label: rank.label,
      description: `Unlocked by reaching ${rank.minWins} battle wins.`,
      textClass: rank.textClass,
      badgeClass: rank.badgeClass,
    }));
}



export function mergeSpecialTitlesForUsername(username = '', unlockedTitles = []) {
  const normalized = String(username || '').trim().toLowerCase();
  const titleMap = new Map((unlockedTitles || []).filter((title) => title?.id).map((title) => [title.id, title]));

  if (normalized === 'grant') {
    titleMap.set('special-spheal-of-approval', {
      id: 'special-spheal-of-approval',
      source: 'special',
      tier: 'special',
      label: 'Spheal of Approval',
      description: 'A unique honorary title for Grant.',
      color: '#d9f1f1',
      textClass: '',
      badgeClass: 'bg-[#d9f1f1]/20 text-white border-[#d9f1f1]/40',
    });
  }

  if (normalized === 'pickles') {
    titleMap.set('special-maus-hunter', {
      id: 'special-maus-hunter',
      source: 'special',
      tier: 'special',
      label: 'Maus Hunter',
      description: 'A unique honorary title for Pickles.',
      color: '#f0f8ff',
      textClass: '',
      badgeClass: 'bg-[#f0f8ff]/20 text-white border-[#f0f8ff]/40',
    });
  }

  return Array.from(titleMap.values());
}

export function mergeAllSetTitles(unlockedTitles = [], sets = []) {
  const titleMap = new Map((unlockedTitles || []).filter((title) => title?.id).map((title) => [title.id, title]));
  for (const set of sets || []) {
    for (const title of buildSetTitles(set?.id, set?.name || set?.id || 'Unknown Set')) {
      if (title?.id) titleMap.set(title.id, title);
    }
  }
  return Array.from(titleMap.values());
}

export function getAllAvailableTitles({ battleWins = 0, unlockedTitles = [] } = {}) {
  const rankTitles = buildBattleRankTitles(battleWins);
  const titleMap = new Map();
  [...rankTitles, ...(unlockedTitles || [])].forEach((title) => {
    if (title?.id) titleMap.set(title.id, title);
  });
  return Array.from(titleMap.values());
}

export function getSelectedUnlockedTitle(unlockedTitles = [], selectedTitleId = null, battleWins = 0) {
  if (!selectedTitleId) return null;
  return getAllAvailableTitles({ battleWins, unlockedTitles }).find((title) => title?.id === selectedTitleId) || null;
}

export function getActiveDisplayTitle({ battleWins = 0, unlockedTitles = [], selectedTitleId = null } = {}) {
  const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, selectedTitleId, battleWins);
  if (selectedTitle) return selectedTitle;
  return getTrainerRank(battleWins);
}
