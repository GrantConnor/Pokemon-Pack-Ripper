import { getTrainerRank } from '@/lib/trainer-ranks';

const TITLE_PALETTES = [
  { textClass: 'text-cyan-300', badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' },
  { textClass: 'text-emerald-300', badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  { textClass: 'text-fuchsia-300', badgeClass: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40' },
  { textClass: 'text-amber-300', badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  { textClass: 'text-violet-300', badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-400/40' },
  { textClass: 'text-rose-300', badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
];

function seededPalette(setId = '') {
  const hash = Array.from(String(setId)).reduce((sum, ch) => ((sum * 33) + ch.charCodeAt(0)) >>> 0, 17);
  return TITLE_PALETTES[hash % TITLE_PALETTES.length];
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
  return `${setName || 'Set'} Curator`;
}

export function buildSetTitles(setId, setName) {
  const palette = seededPalette(setId);
  const themeWord = getThemeWord(setId, setName);
  return [
    {
      id: `set-full-${setId}`,
      setId,
      tier: 'full',
      label: `${themeWord}`,
      description: `Unlocked by completing the numbered set for ${setName}.`,
      ...palette,
    },
    {
      id: `set-master-${setId}`,
      setId,
      tier: 'master',
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
    { projection: { id: 1, collection: 1, unlockedTitles: 1, selectedTitleId: 1 } }
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
      update.selectedTitleId = unlockedTitles[0].id;
    }
    await usersCollection.updateOne({ id: userId }, { $set: update });
    return { unlockedTitles, newlyUnlocked };
  }

  return { unlockedTitles: Array.from(unlockedMap.values()), newlyUnlocked: [] };
}

export function getSelectedUnlockedTitle(unlockedTitles = [], selectedTitleId = null) {
  if (!selectedTitleId) return null;
  return (unlockedTitles || []).find((title) => title?.id === selectedTitleId) || null;
}

export function getActiveDisplayTitle({ battleWins = 0, unlockedTitles = [], selectedTitleId = null } = {}) {
  const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, selectedTitleId);
  if (selectedTitle) return selectedTitle;
  return getTrainerRank(battleWins);
}
