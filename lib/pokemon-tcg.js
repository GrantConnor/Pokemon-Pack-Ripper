import axios from 'axios';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const EXTERNAL_API_TIMEOUT = 15000;
const SETS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CARDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = globalThis.__pokemonTcgSharedCache || {
  sets: null,
  setsFetchedAt: 0,
  cardsBySet: {},
};

globalThis.__pokemonTcgSharedCache = cache;

const SET_PRICING = {
  'base1': { single: 200, bulk: 2000 }, 'base2': { single: 200, bulk: 2000 }, 'basep': { single: 200, bulk: 2000 },
  'jungle': { single: 200, bulk: 2000 }, 'fossil': { single: 200, bulk: 2000 }, 'base3': { single: 200, bulk: 2000 },
  'gym1': { single: 200, bulk: 2000 }, 'gym2': { single: 200, bulk: 2000 }, 'neo1': { single: 200, bulk: 2000 },
  'neo2': { single: 200, bulk: 2000 }, 'neo3': { single: 200, bulk: 2000 }, 'neo4': { single: 200, bulk: 2000 },
  'base4': { single: 200, bulk: 2000 }, 'ecard1': { single: 200, bulk: 2000 }, 'ecard2': { single: 200, bulk: 2000 },
  'ecard3': { single: 200, bulk: 2000 },
  'ex1': { single: 150, bulk: 1500 }, 'ex2': { single: 150, bulk: 1500 }, 'ex3': { single: 150, bulk: 1500 },
  'ex4': { single: 150, bulk: 1500 }, 'ex5': { single: 150, bulk: 1500 }, 'ex6': { single: 150, bulk: 1500 },
  'ex7': { single: 150, bulk: 1500 }, 'ex8': { single: 150, bulk: 1500 }, 'ex9': { single: 150, bulk: 1500 },
  'ex10': { single: 150, bulk: 1500 }, 'ex11': { single: 150, bulk: 1500 }, 'ex12': { single: 150, bulk: 1500 },
};

export function getPackCost(setId, bulk = false) {
  const pricing = SET_PRICING[setId];
  if (pricing) return bulk ? pricing.bulk : pricing.single;
  return bulk ? 1000 : 100;
}


export function normalizeCardRarity(card) {
  const rawRarity = String(card?.rarity || '').trim();
  const rarity = rawRarity.toLowerCase();
  const subtypes = Array.isArray(card?.subtypes) ? card.subtypes.map(s => String(s).toLowerCase()) : [];

  if (rarity.includes('shiny rare') || subtypes.includes('shiny rare')) return 'Shiny Rare';
  if (rarity.includes('hyper rare') || subtypes.includes('hyper rare')) return 'Hyper Rare';
  if (rarity.includes('rare rainbow') || subtypes.includes('rare rainbow')) return 'Rare Rainbow';
  if (rarity.includes('special illustration rare') || subtypes.includes('special illustration rare')) return 'Special Illustration Rare';
  if ((rarity.includes('illustration rare') && !rarity.includes('special')) || subtypes.includes('illustration rare')) return 'Illustration Rare';
  if (rarity.includes('ultra rare') || rarity.includes('rare ultra') || subtypes.includes('ultra rare') || subtypes.includes('rare ultra')) return 'Ultra Rare';
  if (rarity.includes('double rare') || subtypes.includes('double rare')) return 'Double Rare';
  if (rarity.includes('rare holo ex')) return 'Rare Holo EX';
  if ((rarity === 'rare holo' || rarity === 'rare holo v' || rarity === 'rare holo gx') && subtypes.includes('ex')) return 'Rare Holo EX';
  if (rarity.includes('secret rare') || rarity.includes('rare secret') || subtypes.includes('secret rare') || subtypes.includes('rare secret')) return 'Secret Rare';
  if (rawRarity) return rawRarity;
  return 'Common';
}

export function normalizeCard(card) {
  if (!card) return card;
  return {
    ...card,
    rarity: normalizeCardRarity(card),
  };
}

function filterSets(rawSets) {
  const mergedTotals = {
    swsh45: 195, // Shining Fates 73 + Shiny Vault 122
  };

  return rawSets.filter(set => {
    const name = String(set.name || '').toLowerCase();
    const total = set.total || 0;
    if (name.includes('mcdonald')) return false;
    if (name.includes('promo') || name.includes('black star')) return false;
    if (name.includes('trainer kit')) return false;
    if (name.includes('shiny vault')) return false;
    if (set.id === 'swsh12pt5gg' || name.includes('galarian gallery')) return false;
    if (total < 50) return false;
    return true;
  }).map(set => ({
    ...set,
    total: mergedTotals[set.id] || set.total,
    packPrice: getPackCost(set.id, false),
    bulkPrice: getPackCost(set.id, true),
  }));
}

export async function getSets() {
  if (cache.sets && (Date.now() - cache.setsFetchedAt) < SETS_CACHE_TTL_MS) {
    return { sets: cache.sets, cached: true };
  }

  const response = await axios.get(`${POKEMON_TCG_API}/sets`, { timeout: EXTERNAL_API_TIMEOUT });
  const sets = filterSets(response.data.data || []);
  cache.sets = sets;
  cache.setsFetchedAt = Date.now();
  return { sets, cached: false };
}

export async function getCardsForSet(setId) {
  const cached = cache.cardsBySet[setId];
  if (cached && (Date.now() - cached.fetchedAt) < CARDS_CACHE_TTL_MS) {
    return { cards: cached.cards, cached: true };
  }

  let allCards = [];
  if (setId === 'sm115') {
    const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...(hiddenFatesResponse.data.data || []), ...(shinyVaultResponse.data.data || [])];
  } else if (setId === 'swsh45') {
    const shiningFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh45&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh45sv&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...(shiningFatesResponse.data.data || []), ...(shinyVaultResponse.data.data || [])];
  } else if (setId === 'swsh12pt5') {
    const crownZenithResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    const galarianGalleryResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5gg&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...(crownZenithResponse.data.data || []), ...(galarianGalleryResponse.data.data || [])];
  } else {
    const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = response.data.data || [];
  }

  allCards = allCards.map(normalizeCard);
  cache.cardsBySet[setId] = { cards: allCards, fetchedAt: Date.now() };
  return { cards: allCards, cached: false };
}
