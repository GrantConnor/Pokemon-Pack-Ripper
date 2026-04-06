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

function filterSets(rawSets) {
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
  } else if (setId === 'swsh12pt5') {
    const crownZenithResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    const galarianGalleryResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5gg&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...(crownZenithResponse.data.data || []), ...(galarianGalleryResponse.data.data || [])];
  } else {
    const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = response.data.data || [];
  }

  cache.cardsBySet[setId] = { cards: allCards, fetchedAt: Date.now() };
  return { cards: allCards, cached: false };
}
