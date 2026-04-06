import { NextResponse } from 'next/server';
import axios from 'axios';
<<<<<<< HEAD
import { v4 as uuidv4 } from 'uuid';
=======
>>>>>>> 509c79ab0205b2347d5ee7747aef1c4f1d66aed6
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const PACK_COST = 100;
const BULK_PACK_COUNT = 10;
const EXTERNAL_API_TIMEOUT = 15000;
const CARDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const SET_PRICING = {
  'base1': { single: 200, bulk: 2000 },
  'base2': { single: 200, bulk: 2000 },
  'basep': { single: 200, bulk: 2000 },
  'jungle': { single: 200, bulk: 2000 },
  'fossil': { single: 200, bulk: 2000 },
  'base3': { single: 200, bulk: 2000 },
  'gym1': { single: 200, bulk: 2000 },
  'gym2': { single: 200, bulk: 2000 },
  'neo1': { single: 200, bulk: 2000 },
  'neo2': { single: 200, bulk: 2000 },
  'neo3': { single: 200, bulk: 2000 },
  'neo4': { single: 200, bulk: 2000 },
  'base4': { single: 200, bulk: 2000 },
  'ecard1': { single: 200, bulk: 2000 },
  'ecard2': { single: 200, bulk: 2000 },
  'ecard3': { single: 200, bulk: 2000 },
  'ex1': { single: 150, bulk: 1500 },
  'ex2': { single: 150, bulk: 1500 },
  'ex3': { single: 150, bulk: 1500 },
  'ex4': { single: 150, bulk: 1500 },
  'ex5': { single: 150, bulk: 1500 },
  'ex6': { single: 150, bulk: 1500 },
  'ex7': { single: 150, bulk: 1500 },
  'ex8': { single: 150, bulk: 1500 },
  'ex9': { single: 150, bulk: 1500 },
  'ex10': { single: 150, bulk: 1500 },
  'ex11': { single: 150, bulk: 1500 },
  'ex12': { single: 150, bulk: 1500 },
};

const VINTAGE_SETS = [
  'base1', 'base2', 'basep', 'jungle', 'fossil', 'base3',
  'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4',
  'base4', 'ecard1', 'ecard2', 'ecard3'
];

const packCache = globalThis.__pokemonPackOpenCache || { cardsBySet: {} };
globalThis.__pokemonPackOpenCache = packCache;

function getPackCost(setId, bulk = false) {
  const pricing = SET_PRICING[setId];
  if (pricing) return bulk ? pricing.bulk : pricing.single;
  return bulk ? (PACK_COST * 10) : PACK_COST;
}

async function getCardsForSet(setId) {
  const cached = packCache.cardsBySet[setId];
  if (cached && (Date.now() - cached.fetchedAt) < CARDS_CACHE_TTL_MS) {
    return cached.cards;
  }

  let allCards = [];

  if (setId === 'sm115') {
    const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...hiddenFatesResponse.data.data];

    const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...allCards, ...shinyVaultResponse.data.data];
  } else if (setId === 'swsh12pt5') {
    const crownZenithResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...crownZenithResponse.data.data];

    const galarianGalleryResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5gg&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = [...allCards, ...galarianGalleryResponse.data.data];
  } else {
    const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`, { timeout: EXTERNAL_API_TIMEOUT });
    allCards = response.data.data;
  }

  packCache.cardsBySet[setId] = {
    cards: allCards,
    fetchedAt: Date.now(),
  };

  return allCards;
}

function openPack(cards, setId = null) {
  const nonEnergyCards = cards.filter(c => c.supertype !== 'Energy');
  if (nonEnergyCards.length < 10) {
    const pulledCards = [];
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * nonEnergyCards.length);
      pulledCards.push(nonEnergyCards[randomIndex]);
    }
    return pulledCards;
  }

  const commons = nonEnergyCards.filter(c => c.rarity === 'Common');
  const uncommons = nonEnergyCards.filter(c => c.rarity === 'Uncommon');
  const rares = nonEnergyCards.filter(c => c.rarity === 'Rare' || c.rarity === 'Rare Holo');
  const doubleRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Double Rare') || c.rarity.toLowerCase().includes(' ex')));
  const illustrationRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Illustration Rare') && !c.rarity.includes('Special'));
  const ultraRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Ultra Rare') || c.rarity.includes('Rare Ultra')));
  const rainbowRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Rare Rainbow'));
  const specialIllustrationRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Special Illustration Rare'));
  const hyperRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Hyper Rare'));
  const secretRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Rare Secret') || c.rarity.includes('Secret Rare')));

  const pulledCards = [];
  const pulledCardIds = new Set();

  const getUniqueCard = (pool) => {
    const availableCards = pool.filter(card => !pulledCardIds.has(card.id));
    if (availableCards.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];
    pulledCardIds.add(card.id);
    return card;
  };

  const selectRareOrBetter = () => {
    let selectedCard = rares.length > 0 ? getUniqueCard(rares) : getUniqueCard(nonEnergyCards);
    const upgradeRoll = Math.random() * 100;

    if (upgradeRoll < 20) {
      const specialRoll = Math.random() * 100;
      if (specialRoll < 5 && hyperRares.length > 0) return getUniqueCard(hyperRares) || selectedCard;
      if (specialRoll < 10 && secretRares.length > 0) return getUniqueCard(secretRares) || selectedCard;
      if (specialRoll < 20 && specialIllustrationRares.length > 0) return getUniqueCard(specialIllustrationRares) || selectedCard;
      if (specialRoll < 40 && ultraRares.length > 0) return getUniqueCard(ultraRares) || selectedCard;
      if (specialRoll < 60 && rainbowRares.length > 0) return getUniqueCard(rainbowRares) || selectedCard;
      if (specialRoll < 80 && illustrationRares.length > 0) return getUniqueCard(illustrationRares) || selectedCard;
      if (doubleRares.length > 0) return getUniqueCard(doubleRares) || selectedCard;
    }

    return selectedCard;
  };

  for (let i = 0; i < 4; i++) pulledCards.push(getUniqueCard(commons) || getUniqueCard(nonEnergyCards));
  for (let i = 0; i < 3; i++) pulledCards.push(getUniqueCard(uncommons) || getUniqueCard(nonEnergyCards));

  let guaranteedRare;
  if (setId && VINTAGE_SETS.includes(setId)) {
    guaranteedRare = (Math.random() * 100 <= 15)
      ? selectRareOrBetter()
      : (getUniqueCard(uncommons) || getUniqueCard(nonEnergyCards));
  } else {
    guaranteedRare = selectRareOrBetter();
  }
  if (guaranteedRare) pulledCards.push(guaranteedRare);

  const reverseHoloCandidates = nonEnergyCards.filter(c => c.rarity !== 'Rare Secret' && c.rarity !== 'Secret Rare' && c.rarity !== 'Hyper Rare');
  const reverseHoloCard = getUniqueCard(reverseHoloCandidates) || getUniqueCard(nonEnergyCards);
  if (reverseHoloCard) pulledCards.push({ ...reverseHoloCard, isReverseHolo: true });

  const finalCard = getUniqueCard(nonEnergyCards) || getUniqueCard(rares) || getUniqueCard(uncommons) || getUniqueCard(commons);
  if (finalCard) pulledCards.push(finalCard);

  return pulledCards.filter(Boolean).slice(0, 10);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, setId, bulk } = body || {};

    if (!userId || !setId) {
      return NextResponse.json({ error: 'User ID and Set ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const user = await database.collection('users').findOne(
      { id: userId },
      { projection: { id: 1, username: 1, points: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const packCount = bulk ? BULK_PACK_COUNT : 1;
    const totalCost = getPackCost(setId, bulk);

    if (user.username !== 'Spheal' && user.points < totalCost) {
      return NextResponse.json({
        error: 'Insufficient points',
        pointsNeeded: totalCost - user.points,
      }, { status: 402 });
    }

    const allCards = await getCardsForSet(setId);
    if (!allCards.length) {
      return NextResponse.json({ error: 'No cards found for this set' }, { status: 404 });
    }

    let allPulledCards = [];
    const individualPacks = [];
    for (let i = 0; i < packCount; i++) {
      const pulledCards = openPack(allCards, setId);
      allPulledCards = [...allPulledCards, ...pulledCards];
      if (bulk) {
        individualPacks.push({ packNumber: i + 1, cards: pulledCards });
      }
    }

    const newPoints = user.username === 'Spheal' ? 999999 : user.points - totalCost;
    const pulledAt = new Date().toISOString();
    const cardsWithTimestamp = allPulledCards.map((card, index) => ({
      ...card,
      pulledAt,
      packNumber: bulk ? Math.floor(index / 10) + 1 : 1,
    }));

    const packsWithTimestamps = bulk
      ? individualPacks.map(pack => ({
          packNumber: pack.packNumber,
          cards: pack.cards.map(card => ({ ...card, pulledAt, packNumber: pack.packNumber })),
        }))
      : null;

    await database.collection('users').updateOne(
      { id: userId },
      {
        $push: {
          collection: { $each: cardsWithTimestamp },
        },
        $set: { points: newPoints },
      }
    );

<<<<<<< HEAD
    const revealId = uuidv4();
    await database.collection('pack_reveals').insertOne({
      id: revealId,
      userId,
      cards: cardsWithTimestamp,
      packs: packsWithTimestamps,
      isBulk: !!bulk,
      pointsRemaining: newPoints,
      createdAt: new Date().toISOString(),
      revealed: false,
    });

    return NextResponse.json({
      success: true,
      revealId,
=======
    return NextResponse.json({
      success: true,
>>>>>>> 509c79ab0205b2347d5ee7747aef1c4f1d66aed6
      cards: cardsWithTimestamp,
      packs: packsWithTimestamps,
      isBulk: bulk,
      pointsRemaining: newPoints,
      achievements: null,
      xpApplied: false,
    });
  } catch (error) {
    return NextResponse.json({
      error: error?.message || 'Failed to open pack',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
