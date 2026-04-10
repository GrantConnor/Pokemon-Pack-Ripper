import { getTrainerRank, TRAINER_RANKS } from '@/lib/trainer-ranks';
import { getCardsForSet, getCollectibleCards } from '@/lib/pokemon-tcg';

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


const CUSTOM_SET_TITLES_BY_ID = {
  base1: 'Pioneer',
  base2: 'Jungle Warden',
  base3: 'Relic Seeker',
  base4: 'Pioneer',
  base5: 'Team Rocket',
  base6: 'Legend Keeper',
  gym1: 'Badge Master',
  gym2: 'Badge Master',
  neo1: 'Neo Ascendant',
  neo2: 'Neo Ascendant',
  neo3: 'Neo Ascendant',
  neo4: 'Neo Ascendant',
  ecard1: 'Pathfinder',
  ecard2: 'Tide Sovereign',
  ecard3: 'Sky Oracle',
  ex1: 'Hoenn Vanguard',
  ex2: 'Dune Caller',
  ex3: 'Drakebound',
  ex4: 'Elemental Commander',
  ex5: 'Hidden Legend',
  ex7: 'Team Rocket',
  ex8: 'Cosmic Cipher',
  ex9: 'Emerald Master',
  ex10: 'Phantom Tracker',
  ex11: 'Delta Savant',
  ex12: 'Mythforger',
  ex13: 'Phantom',
  ex14: 'Forged in Crystal',
  ex15: 'Dragonborne',
  ex16: 'Powerful',
};

const LEGACY_SET_NAMES_BY_ID = {
  base1: 'Base Set',
  base2: 'Jungle',
  base3: 'Fossil',
  base4: 'Base Set 2',
  base5: 'Team Rocket',
  base6: 'Legendary Collection',
  gym1: 'Gym Heroes',
  gym2: 'Gym Challenge',
  neo1: 'Neo Genesis',
  neo2: 'Neo Discovery',
  neo3: 'Neo Revelation',
  neo4: 'Neo Destiny',
  ecard1: 'Expedition Base Set',
  ecard2: 'Aquapolis',
  ecard3: 'Skyridge',
  ex1: 'Ruby & Sapphire',
  ex2: 'Sandstorm',
  ex3: 'Dragon',
  ex4: 'Team Magma vs Team Aqua',
  ex5: 'Hidden Legends',
  ex6: 'FireRed & LeafGreen',
  ex7: 'Team Rocket Returns',
  ex8: 'Deoxys',
  ex9: 'Emerald',
  ex10: 'Unseen Forces',
  ex11: 'Delta Species',
  ex12: 'Legend Maker',
  ex13: 'Holon Phantoms',
  ex14: 'Crystal Guardians',
  ex15: 'Dragon Frontiers',
  ex16: 'Power Keepers',
};

const CUSTOM_SET_TITLE_RULES = [
  ['base set', 'Pioneer'],
  ['jungle', 'Jungle Warden'],
  ['fossil', 'Relic Seeker'],
  ['gym heroes', 'Badge Master'],
  ['gym challenge', 'Badge Master'],
  ['neo ', 'Neo Ascendant'],
  ['legendary collection', 'Legend Keeper'],
  ['expedition', 'Pathfinder'],
  ['aquapolis', 'Tide Sovereign'],
  ['skyridge', 'Sky Oracle'],
  ['ruby & sapphire', 'Hoenn Vanguard'],
  ['sandstorm', 'Dune Caller'],
  ['dragon ', 'Drakebound'],
  ['team magma vs team aqua', 'Elemental Commander'],
  ['hidden legends', 'Hidden Legend'],
  ['team rocket returns', 'Team Rocket'],
  ['team rocket', 'Team Rocket'],
  ['deoxys', 'Cosmic Cipher'],
  ['emerald', 'Emerald Master'],
  ['unseen forces', 'Phantom Tracker'],
  ['delta species', 'Delta Savant'],
  ['legend maker', 'Mythforger'],
  ['holon phantoms', 'Phantom'],
  ['crystal guardians', 'Forged in Crystal'],
  ['dragon frontiers', 'Dragonborne'],
  ['power keepers', 'Powerful'],
  ['diamond & pearl', 'Lord of Time and Space'],
  ['mysterious treasures', 'Lord of Time and Space'],
  ['secret wonders', 'Lord of Time and Space'],
  ['great encounters', 'Lord of Time and Space'],
  ['majestic dawn', 'Lord of Time and Space'],
  ['legends awakened', 'Lord of Time and Space'],
  ['stormfront', 'Lord of Time and Space'],
  ['platinum', 'Platinum'],
  ['rising rivals', 'Platinum'],
  ['supreme victors', 'Platinum'],
  ['arceus', 'Platinum'],
  ['heartgold', 'Heart & Soul'],
  ['soulsilver', 'Heart & Soul'],
  ['unleashed', 'Heart & Soul'],
  ['undaunted', 'Heart & Soul'],
  ['triumphant', 'Heart & Soul'],
  ['call of legends', 'Legend Caller'],
  ['black & white', 'Colorless'],
  ['emerging powers', 'Colorless'],
  ['noble victories', 'Colorless'],
  ['next destinies', 'Colorless'],
  ['dark explorers', 'Colorless'],
  ['dragons exalted', 'Colorless'],
  ['boundaries crossed', 'Colorless'],
  ['plasma storm', 'Colorless'],
  ['plasma freeze', 'Colorless'],
  ['plasma blast', 'Colorless'],
  ['legendary treasures', 'Colorless'],
  ['xy', 'Kalos Crown Collector'],
  ['flashfire', 'Kalos Crown Collector'],
  ['furious fists', 'Kalos Crown Collector'],
  ['phantom forces', 'Kalos Crown Collector'],
  ['primal clash', 'Kalos Crown Collector'],
  ['roaring skies', 'Kalos Crown Collector'],
  ['ancient origins', 'Kalos Crown Collector'],
  ['breakthrough', 'Kalos Crown Collector'],
  ['breakpoint', 'Kalos Crown Collector'],
  ['generations', 'Kalos Crown Collector'],
  ['fates collide', 'Kalos Crown Collector'],
  ['steam siege', 'Kalos Crown Collector'],
  ['evolutions', 'Kalos Crown Collector'],
  ['sun & moon', 'Alola Grandmaster'],
  ['guardians rising', 'Guardian of Alola'],
  ['burning shadows', 'Burning Shadow'],
  ['shining legends', 'Shining Legend'],
  ['crimson invasion', 'Crimson Blood'],
  ['ultra prism', 'Ultra Prism'],
  ['forbidden light', 'Forbidden'],
  ['celestial storm', 'Celestial'],
  ['dragon majesty', 'Dragon Royalty'],
  ['lost thunder', 'Thunder Finder'],
  ['team up', 'Teaming Up'],
  ['unbroken bonds', 'Bonded'],
  ['unified minds', 'Unified'],
  ['hidden fates', 'Hidden'],
  ['cosmic eclipse', 'Eclipsed'],
  ['sword & shield', 'Sword and Shield'],
  ['rebel clash', 'Sword and Shield'],
  ['darkness ablaze', 'Sword and Shield'],
  ['vivid voltage', 'Sword and Shield'],
  ['battle styles', 'Sword and Shield'],
  ['chilling reign', 'Ice King'],
  ['evolving skies', 'Master of Skies'],
  ['fusion strike', 'Fusion Tempest'],
  ['shining fates', 'Shiny'],
  ['scarlet & violet', 'Hues of Purple'],
  ['paldea evolved', 'Paldean'],
  ['obsidian flames', 'Eternal Burning'],
  ['151', '151'],
  ['paradox rift', 'From Another World'],
  ['paldean fates', 'Very Shiny'],
  ['temporal forces', 'Tempered'],
  ['twilight masquerade', 'Masqueraded'],
  ['shrouded fable', 'Fable'],
  ['stellar crown', 'Royalty'],
  ['surging sparks', 'Electrifying'],
  ['prismatic evolutions', 'Prismatic'],
  ['journey together', 'Friends are Forever'],
  ['destined rivals', 'Rival'],
  ['black bolt', 'Black'],
  ['white flare', 'White'],
  ['mega evolution', 'MEGA'],
  ['phantasmal flames', 'Burning Bright'],
  ['ascended heroes', 'Ascended Hero'],
  ['perfect order', 'Perfect'],
];

function seededHash(value = '') {
  return Array.from(String(value)).reduce((sum, ch) => ((sum * 33) + ch.charCodeAt(0)) >>> 0, 17);
}

function seededPalette(setId = '') {
  return TITLE_PALETTES[seededHash(setId) % TITLE_PALETTES.length];
}

function resolveCustomSetTitle(setId = '', setName = '') {
  if (CUSTOM_SET_TITLES_BY_ID[setId]) return CUSTOM_SET_TITLES_BY_ID[setId];
  const normalizedName = String(setName || '').trim().toLowerCase();
  for (const [needle, title] of CUSTOM_SET_TITLE_RULES) {
    if (normalizedName.includes(needle)) return title;
  }
  return String(setName || setId || 'Set Champion').trim();
}

function getCanonicalSetTitleId(setId = '') {
  return `set-complete-${setId}`;
}

function solidStyle(color, badgeClass) {
  return {
    color,
    textClass: '',
    badgeClass: badgeClass || 'bg-slate-900/70 text-white border-white/30',
  };
}

function gradientStyle(textClass, badgeClass) {
  return {
    textClass,
    badgeClass: badgeClass || 'bg-slate-900/70 text-white border-white/30',
  };
}

function resolveCustomTitleStyle(setId = '', setName = '', basePalette = {}) {
  const normalizedName = String(setName || '').toLowerCase();

  if (normalizedName.includes('base set') || normalizedName.includes('ruby & sapphire') || normalizedName.includes('xy')) {
    return gradientStyle(
      'bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-red-500/20 to-blue-500/20 text-white border-cyan-300/40'
    );
  }

  if (normalizedName.includes('jungle')) return solidStyle('#048243', 'bg-[#048243]/20 text-[#baf1cf] border-[#048243]/40');
  if (normalizedName.includes('fossil')) return solidStyle('#e3dac9', 'bg-[#e3dac9]/20 text-[#f5efe6] border-[#e3dac9]/40');
  if (normalizedName.includes('gym heroes') || normalizedName.includes('gym challenge')) return solidStyle('#d3d3d3', 'bg-slate-200/20 text-slate-100 border-slate-300/40');
  if (normalizedName.includes('neo ')) return solidStyle('#60a5fa', 'bg-blue-500/20 text-blue-200 border-blue-400/40');
  if (normalizedName.includes('legendary collection') || normalizedName.includes('expedition') || normalizedName.includes('power keepers') || normalizedName.includes('shining legends') || normalizedName.includes('dragon majesty')) return solidStyle('#f5c542', 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40');
  if (normalizedName.includes('aquapolis')) return solidStyle('#416bdf', 'bg-[#416bdf]/20 text-[#dbe7ff] border-[#416bdf]/40');
  if (normalizedName.includes('skyridge')) return solidStyle('#78d978', 'bg-[#78d978]/20 text-[#e6ffe6] border-[#78d978]/40');
  if (normalizedName.includes('sandstorm')) return solidStyle('#dfc9ab', 'bg-[#dfc9ab]/20 text-[#fff6e8] border-[#dfc9ab]/40');
  if (normalizedName === 'dragon' || normalizedName.startsWith('dragon ') || normalizedName.includes('dragon frontiers')) return solidStyle('#7f1d1d', 'bg-red-900/30 text-red-200 border-red-700/40');
  if (normalizedName.includes('team magma vs team aqua')) {
    return gradientStyle(
      'bg-gradient-to-r from-orange-500 to-blue-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-white border-cyan-300/40'
    );
  }
  if (normalizedName.includes('hidden legends') || normalizedName.includes('151') || normalizedName.includes('journey together') || normalizedName.includes('white flare') || normalizedName.includes('perfect order')) return solidStyle('#ffffff', 'bg-white/10 text-white border-white/40');
  if (normalizedName.includes('team rocket')) return solidStyle('#ef4444', 'bg-red-500/20 text-red-200 border-red-400/40');
  if (normalizedName.includes('deoxys')) return solidStyle('#800080', 'bg-purple-500/20 text-purple-200 border-purple-400/40');
  if (normalizedName.includes('emerald') || normalizedName.includes('evolving skies')) return solidStyle('#51c429', 'bg-[#51c429]/20 text-[#dfffd4] border-[#51c429]/40');
  if (normalizedName.includes('unseen forces')) return solidStyle('rgba(128, 0, 128, 0.8)', 'bg-purple-500/20 text-purple-200 border-purple-400/30');
  if (normalizedName.includes('delta species')) return solidStyle('#ae844c', 'bg-[#ae844c]/20 text-[#f4eadb] border-[#ae844c]/40');
  if (normalizedName.includes('legend maker')) {
    return gradientStyle(
      'bg-gradient-to-r from-blue-500 to-yellow-400 bg-clip-text text-transparent',
      'bg-gradient-to-r from-blue-500/20 to-yellow-400/20 text-white border-blue-300/40'
    );
  }
  if (normalizedName.includes('holon phantoms')) return solidStyle('rgba(128, 0, 128, 0.7)', 'bg-purple-500/15 text-purple-200 border-purple-400/30');
  if (normalizedName.includes('crystal guardians')) return solidStyle('#7debf0', 'bg-[#7debf0]/20 text-[#ecfeff] border-[#7debf0]/40');
  if (normalizedName.includes('dragon frontiers')) return solidStyle('#b94d42', 'bg-[#b94d42]/20 text-[#ffe6e2] border-[#b94d42]/40');
  if (normalizedName.includes('diamond & pearl') || normalizedName.includes('mysterious treasures') || normalizedName.includes('secret wonders') || normalizedName.includes('great encounters') || normalizedName.includes('majestic dawn') || normalizedName.includes('legends awakened') || normalizedName.includes('stormfront') || normalizedName.includes('ultra prism')) return solidStyle('#f0f8ff', 'bg-[#f0f8ff]/15 text-[#f0f8ff] border-[#f0f8ff]/35');
  if (normalizedName.includes('platinum') || normalizedName.includes('rising rivals') || normalizedName.includes('supreme victors') || normalizedName.includes('arceus')) return solidStyle('#4ca275', 'bg-[#4ca275]/20 text-[#dffbea] border-[#4ca275]/40');
  if (normalizedName.includes('heartgold') || normalizedName.includes('soulsilver') || normalizedName.includes('unleashed') || normalizedName.includes('undaunted') || normalizedName.includes('triumphant')) {
    return gradientStyle(
      'bg-gradient-to-r from-amber-400 to-pink-300 bg-clip-text text-transparent',
      'bg-gradient-to-r from-amber-400/20 to-pink-300/20 text-white border-amber-300/40'
    );
  }
  if (normalizedName.includes('call of legends') || normalizedName.includes('lost thunder')) return solidStyle('#60a5fa', 'bg-blue-500/20 text-blue-200 border-blue-400/40');

  if (
    normalizedName.includes('black & white') ||
    normalizedName.includes('emerging powers') ||
    normalizedName.includes('noble victories') ||
    normalizedName.includes('next destinies') ||
    normalizedName.includes('dark explorers') ||
    normalizedName.includes('dragons exalted') ||
    normalizedName.includes('boundaries crossed') ||
    normalizedName.includes('plasma storm') ||
    normalizedName.includes('plasma freeze') ||
    normalizedName.includes('plasma blast') ||
    normalizedName.includes('legendary treasures')
  ) {
    return gradientStyle(
      'bg-gradient-to-r from-black via-gray-400 to-white bg-clip-text text-transparent',
      'bg-gradient-to-r from-black via-gray-500 to-white text-white border-gray-400/50'
    );
  }

  if (normalizedName.includes('sun & moon') || normalizedName.includes('celestial storm')) {
    return gradientStyle(
      'bg-gradient-to-r from-yellow-200 to-blue-50 bg-clip-text text-transparent',
      'bg-gradient-to-r from-yellow-200/20 to-blue-50/20 text-white border-yellow-100/40'
    );
  }
  if (normalizedName.includes('guardians rising') || normalizedName.includes('twilight masquerade')) return solidStyle('#7c3aed', 'bg-violet-500/20 text-violet-200 border-violet-400/40');
  if (normalizedName.includes('burning shadows')) return solidStyle('#581c87', 'bg-purple-900/30 text-purple-200 border-purple-700/40');
  if (normalizedName.includes('crimson invasion') || normalizedName.includes('destined rivals')) return solidStyle('#7f1d1d', 'bg-red-900/30 text-red-200 border-red-700/40');
  if (normalizedName.includes('forbidden light')) return solidStyle('#000000', 'bg-black/50 text-white border-white/20');
  if (normalizedName.includes('dragon majesty')) {
    return gradientStyle(
      'bg-gradient-to-r from-yellow-400 to-red-900 bg-clip-text text-transparent',
      'bg-gradient-to-r from-yellow-400/20 to-red-900/20 text-white border-yellow-300/30'
    );
  }
  if (normalizedName.includes('team up')) {
    return gradientStyle(
      'bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-red-500/20 to-purple-500/20 text-white border-purple-300/40'
    );
  }
  if (normalizedName.includes('unbroken bonds') || normalizedName.includes('chilling reign')) return solidStyle('#22d3ee', normalizedName.includes('chilling reign') ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' : 'bg-blue-500/20 text-blue-200 border-blue-400/40');
  if (normalizedName.includes('unified minds')) return solidStyle('#22c55e', 'bg-green-500/20 text-green-200 border-green-400/40');
  if (normalizedName.includes('hidden fates')) return solidStyle('rgba(211, 211, 211, 0.8)', 'bg-slate-200/10 text-slate-100 border-slate-300/30');
  if (normalizedName.includes('cosmic eclipse')) {
    return gradientStyle(
      'bg-gradient-to-r from-black to-yellow-400 bg-clip-text text-transparent',
      'bg-gradient-to-r from-black/30 to-yellow-400/20 text-white border-yellow-300/30'
    );
  }
  if (normalizedName.includes('sword & shield') || normalizedName.includes('rebel clash') || normalizedName.includes('darkness ablaze') || normalizedName.includes('vivid voltage') || normalizedName.includes('battle styles')) {
    return gradientStyle(
      'bg-gradient-to-r from-slate-200 to-blue-400 bg-clip-text text-transparent',
      'bg-gradient-to-r from-slate-200/20 to-blue-400/20 text-white border-blue-300/40'
    );
  }
  if (normalizedName.includes('fusion strike')) return solidStyle('#facc15', 'bg-yellow-400/20 text-yellow-200 border-yellow-300/40');
  if (normalizedName.includes('shining fates')) return solidStyle('#fde68a', 'bg-yellow-200/20 text-yellow-100 border-yellow-200/40');
  if (normalizedName.includes('scarlet & violet')) {
    return gradientStyle(
      'bg-gradient-to-r from-red-500 to-violet-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-red-500/20 to-violet-500/20 text-white border-violet-300/40'
    );
  }
  if (normalizedName.includes('paldea evolved')) return solidStyle('#d2b48c', 'bg-[#d2b48c]/20 text-[#fff3df] border-[#d2b48c]/40');
  if (normalizedName.includes('obsidian flames')) {
    return gradientStyle(
      'bg-gradient-to-r from-black to-orange-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-black/30 to-orange-500/20 text-white border-orange-300/30'
    );
  }
  if (normalizedName.includes('paradox rift')) {
    return gradientStyle(
      'bg-gradient-to-r from-blue-950 to-white bg-clip-text text-transparent',
      'bg-gradient-to-r from-blue-950/30 to-white/20 text-white border-blue-300/30'
    );
  }
  if (normalizedName.includes('paldean fates')) {
    return gradientStyle(
      'bg-gradient-to-r from-white to-yellow-200 bg-clip-text text-transparent',
      'bg-gradient-to-r from-white/20 to-yellow-200/20 text-white border-yellow-200/40'
    );
  }
  if (normalizedName.includes('temporal forces')) return solidStyle('#5b7c99', 'bg-[#5b7c99]/20 text-[#e1edf7] border-[#5b7c99]/40');
  if (normalizedName.includes('shrouded fable')) return solidStyle('#f9a8d4', 'bg-pink-300/20 text-pink-100 border-pink-300/40');
  if (normalizedName.includes('stellar crown') || normalizedName.includes('surging sparks')) return solidStyle('#facc15', 'bg-yellow-400/20 text-yellow-200 border-yellow-300/40');
  if (normalizedName.includes('prismatic evolutions')) {
    return gradientStyle(
      'bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent',
      'bg-gradient-to-r from-red-400/20 via-yellow-300/20 to-purple-500/20 text-white border-white/30'
    );
  }
  if (normalizedName.includes('black bolt')) return solidStyle('#000000', 'bg-black/60 text-white border-white/20');
  if (normalizedName.includes('white flare')) return solidStyle('#ffffff', 'bg-white/10 text-white border-white/40');
  if (normalizedName.includes('mega evolution')) return solidStyle('#fb923c', 'bg-orange-400/20 text-orange-100 border-orange-300/40');
  if (normalizedName.includes('phantasmal flames')) {
    return gradientStyle(
      'bg-gradient-to-r from-purple-600 via-red-500 to-black bg-clip-text text-transparent',
      'bg-gradient-to-r from-purple-600/20 via-red-500/20 to-black/30 text-white border-red-300/30'
    );
  }
  if (normalizedName.includes('ascended heroes')) {
    return gradientStyle(
      'bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent',
      'bg-gradient-to-r from-yellow-300/20 to-orange-400/20 text-white border-yellow-200/40'
    );
  }

  return basePalette;
}


function extractLegacySetId(title = {}) {
  if (title?.setId) return String(title.setId);
  const rawId = String(title?.id || '');
  return rawId.replace(/^set-(?:full|master|complete)-/, '');
}

export function buildSetTitles(setId, setName) {
  const palette = resolveCustomTitleStyle(setId, setName, seededPalette(setId));
  return [{
    id: getCanonicalSetTitleId(setId),
    setId,
    setName,
    tier: 'complete',
    source: 'set',
    label: resolveCustomSetTitle(setId, setName),
    description: `Unlocked by completing ${setName}.`,
    ...palette,
  }];
}

export function evaluateSetCompletion(userCollection = [], allCards = [], setId) {
  const setCards = getCollectibleCards(allCards).filter((card) => card?.set?.id === setId || !setId);
  const totalCards = setCards.length;
  const collectedSetCards = userCollection.filter((card) => card?.set?.id === setId);
  const uniqueIds = new Set(collectedSetCards.map((card) => card.id));

  const previewCountMatched = totalCards > 0 && uniqueIds.size >= totalCards;

  return {
    setCompleted: previewCountMatched,
    uniqueCount: uniqueIds.size,
    totalCards,
    printedTotal: totalCards,
  };
}

export function normalizeUnlockedTitles(unlockedTitles = []) {
  const titleMap = new Map();

  for (const title of unlockedTitles || []) {
    if (!title?.id) continue;

    if (title.source === 'set' || /^set-(?:full|master|complete)-/.test(title.id)) {
      const setId = extractLegacySetId(title);
      if (!setId) continue;
      const canonicalSetName = title?.setName || LEGACY_SET_NAMES_BY_ID[setId] || setId;
      const canonical = buildSetTitles(setId, canonicalSetName)[0];
      titleMap.set(canonical.id, canonical);
      continue;
    }

    titleMap.set(title.id, title);
  }

  return Array.from(titleMap.values());
}

export function normalizeSelectedTitleId(selectedTitleId = null) {
  if (!selectedTitleId) return null;
  if (/^set-(?:full|master|complete)-/.test(selectedTitleId)) {
    const setId = selectedTitleId.replace(/^set-(?:full|master|complete)-/, '');
    return getCanonicalSetTitleId(setId);
  }
  return selectedTitleId;
}

export async function unlockSetTitlesForUser(usersCollection, userId, setId, setName, allCards) {
  const user = await usersCollection.findOne(
    { id: userId },
    { projection: { id: 1, collection: 1, unlockedTitles: 1, selectedTitleId: 1, battleWins: 1 } }
  );
  if (!user) return { unlockedTitles: [], newlyUnlocked: [] };

  const completion = evaluateSetCompletion(user.collection || [], allCards, setId);
  const title = buildSetTitles(setId, setName)[0];
  const unlockedMap = new Map(normalizeUnlockedTitles(user.unlockedTitles || []).map((item) => [item.id, item]));
  const newlyUnlocked = [];

  if (completion.setCompleted && !unlockedMap.has(title.id)) {
    unlockedMap.set(title.id, title);
    newlyUnlocked.push(title);
  }

  const unlockedTitles = Array.from(unlockedMap.values());
  const update = {
    unlockedTitles,
    selectedTitleId: normalizeSelectedTitleId(user.selectedTitleId),
  };
  if (!update.selectedTitleId) {
    update.selectedTitleId = `rank-${slugifyTitleLabel(getTrainerRank(user.battleWins || 0).label)}`;
  }

  if (newlyUnlocked.length || JSON.stringify(unlockedTitles) !== JSON.stringify(user.unlockedTitles || []) || update.selectedTitleId !== (user.selectedTitleId || null)) {
    await usersCollection.updateOne({ id: userId }, { $set: update });
  }

  return { unlockedTitles, newlyUnlocked };
}

export async function awardSetTitlesForUser(usersCollection, userId, changedSetIds = []) {
  const setIds = Array.from(new Set((changedSetIds || []).filter(Boolean)));
  if (!userId || !setIds.length) {
    return { unlockedTitles: [], newlyUnlocked: [] };
  }

  const user = await usersCollection.findOne(
    { id: userId },
    { projection: { id: 1, collection: 1, unlockedTitles: 1, selectedTitleId: 1, battleWins: 1 } }
  );
  if (!user) return { unlockedTitles: [], newlyUnlocked: [] };

  const unlockedMap = new Map(normalizeUnlockedTitles(user.unlockedTitles || []).map((title) => [title.id, title]));
  const newlyUnlocked = [];

  for (const setId of setIds) {
    const ownedFromSet = (user.collection || []).filter((card) => card?.set?.id === setId);
    if (!ownedFromSet.length) continue;

    let authoritativeCards = [];
    try {
      const response = await getCardsForSet(setId);
      authoritativeCards = response?.cards || [];
    } catch {
      authoritativeCards = [];
    }
    if (!authoritativeCards.length) continue;

    const setName = authoritativeCards[0]?.set?.name || ownedFromSet[0]?.set?.name || setId;
    const completion = evaluateSetCompletion(user.collection || [], authoritativeCards, setId);
    const title = buildSetTitles(setId, setName)[0];

    if (completion.setCompleted && !unlockedMap.has(title.id)) {
      unlockedMap.set(title.id, title);
      newlyUnlocked.push(title);
    }
  }

  const unlockedTitles = Array.from(unlockedMap.values());
  const nextSelectedTitleId = normalizeSelectedTitleId(user.selectedTitleId);
  if (newlyUnlocked.length || JSON.stringify(unlockedTitles) !== JSON.stringify(user.unlockedTitles || []) || nextSelectedTitleId !== (user.selectedTitleId || null)) {
    const update = { unlockedTitles, selectedTitleId: nextSelectedTitleId };
    if (!update.selectedTitleId) {
      update.selectedTitleId = `rank-${slugifyTitleLabel(getTrainerRank(user.battleWins || 0).label)}`;
    }
    await usersCollection.updateOne({ id: userId }, { $set: update });
  }

  return { unlockedTitles, newlyUnlocked };
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
  const titleMap = new Map(normalizeUnlockedTitles(unlockedTitles).filter((title) => title?.id).map((title) => [title.id, title]));

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

    const grantDeoxysTitle = buildSetTitles('ex8', 'Deoxys')[0];
    titleMap.set(grantDeoxysTitle.id, grantDeoxysTitle);
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

export function getAllAvailableTitles({ battleWins = 0, unlockedTitles = [] } = {}) {
  const rankTitles = buildBattleRankTitles(battleWins);
  const titleMap = new Map();
  [...rankTitles, ...normalizeUnlockedTitles(unlockedTitles)].forEach((title) => {
    if (title?.id) titleMap.set(title.id, title);
  });
  return Array.from(titleMap.values());
}

export function getSelectedUnlockedTitle(unlockedTitles = [], selectedTitleId = null, battleWins = 0) {
  const normalizedSelectedTitleId = normalizeSelectedTitleId(selectedTitleId);
  if (!normalizedSelectedTitleId) return null;
  return getAllAvailableTitles({ battleWins, unlockedTitles }).find((title) => title?.id === normalizedSelectedTitleId) || null;
}

export function getActiveDisplayTitle({ battleWins = 0, unlockedTitles = [], selectedTitleId = null } = {}) {
  const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, selectedTitleId, battleWins);
  if (selectedTitle) return selectedTitle;
  return getTrainerRank(battleWins);
}
