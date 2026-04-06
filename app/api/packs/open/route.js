import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/mongodb';
import { getCardsForSet, getPackCost } from '@/lib/pokemon-tcg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BULK_PACK_COUNT = 10;

const LEGACY_SETS = [
  'base1', 'base2', 'basep', 'jungle', 'fossil', 'base3',
  'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4',
  'base4', 'ecard1', 'ecard2', 'ecard3',
  'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6',
  'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12'
];


function openPack(cards, setId = null) {
  const nonEnergyCards = cards.filter(card => card.supertype !== 'Energy');
  if (nonEnergyCards.length < 10) {
    const pulledCards = [];
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * nonEnergyCards.length);
      pulledCards.push(nonEnergyCards[randomIndex]);
    }
    return pulledCards;
  }

  const pulledCards = [];
  const pulledCardIds = new Set();

  const getUniqueCard = (pool) => {
    const availableCards = pool.filter(card => !pulledCardIds.has(card.id));
    if (!availableCards.length) return null;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];
    pulledCardIds.add(card.id);
    return card;
  };

  const rarityValue = (card) => String(card?.rarity || '').toLowerCase();
  const isStandardRareCard = (card) => {
    const rarity = rarityValue(card);
    return rarity === 'rare' || rarity === 'rare holo';
  };
  const isSpecialRareCard = (card) => {
    const rarity = rarityValue(card);
    return (
      rarity.includes('double rare') ||
      rarity.includes('shiny rare') ||
      (rarity.includes('illustration rare') && !rarity.includes('special')) ||
      rarity.includes('special illustration rare') ||
      rarity.includes('ultra rare') ||
      rarity.includes('rare ultra') ||
      rarity.includes('rare holo ex') ||
      rarity.includes('rare rainbow') ||
      rarity.includes('hyper rare') ||
      rarity.includes('secret rare') ||
      rarity.includes('rare secret')
    );
  };

  const commons = nonEnergyCards.filter(card => rarityValue(card) === 'common');
  const uncommons = nonEnergyCards.filter(card => rarityValue(card) === 'uncommon');
  const lowRarityCards = nonEnergyCards.filter(card => !isStandardRareCard(card) && !isSpecialRareCard(card));
  const standardRares = nonEnergyCards.filter(isStandardRareCard);

  const specialPools = {
    doubleRare: nonEnergyCards.filter(card => rarityValue(card).includes('double rare') || rarityValue(card).includes('rare holo ex')),
    shinyRare: nonEnergyCards.filter(card => rarityValue(card).includes('shiny rare')),
    ultraRare: nonEnergyCards.filter(card => rarityValue(card).includes('ultra rare') || rarityValue(card).includes('rare ultra')),
    illustrationRare: nonEnergyCards.filter(card => rarityValue(card).includes('illustration rare')),
    rainbowRare: nonEnergyCards.filter(card => rarityValue(card).includes('rare rainbow')),
    hyperRare: nonEnergyCards.filter(card => rarityValue(card).includes('hyper rare')),
    secretRare: nonEnergyCards.filter(card => {
      const rarity = rarityValue(card);
      const handled = [
        'double rare',
        'rare holo ex',
        'shiny rare',
        'ultra rare',
        'rare ultra',
        'illustration rare',
        'rare rainbow',
        'hyper rare',
        'secret rare',
        'rare secret'
      ].some(token => rarity.includes(token));
      if (rarity.includes('secret rare') || rarity.includes('rare secret')) {
        return true;
      }
      return !handled && rarity.includes('rare');
    }),
  };

  const lowPool = lowRarityCards.length ? lowRarityCards : nonEnergyCards;

  for (let i = 0; i < 5; i++) {
    pulledCards.push(getUniqueCard(commons) || getUniqueCard(lowPool) || getUniqueCard(nonEnergyCards));
  }

  for (let i = 0; i < 3; i++) {
    pulledCards.push(getUniqueCard(uncommons) || getUniqueCard(lowPool) || getUniqueCard(nonEnergyCards));
  }

  const reverseHoloBase = getUniqueCard(lowPool) || getUniqueCard(nonEnergyCards);
  if (reverseHoloBase) {
    pulledCards.push({ ...reverseHoloBase, isReverseHolo: true });
  }

  const weightedSpecialTable = [
    { key: 'doubleRare', weight: 45 },
    { key: 'shinyRare', weight: 15 },
    { key: 'ultraRare', weight: 15 },
    { key: 'illustrationRare', weight: 15 },
    { key: 'rainbowRare', weight: 5 },
    { key: 'hyperRare', weight: 2.5 },
    { key: 'secretRare', weight: 2.5 },
  ];
  const availableSpecialPoolKeys = weightedSpecialTable.filter(entry => specialPools[entry.key]?.length > 0);
  const hitSpecialTable = Math.random() < 0.10;

  const pickWeightedSpecialPoolKey = () => {
    const totalWeight = availableSpecialPoolKeys.reduce((sum, entry) => sum + entry.weight, 0);
    if (!totalWeight) return null;
    let roll = Math.random() * totalWeight;
    for (const entry of availableSpecialPoolKeys) {
      roll -= entry.weight;
      if (roll <= 0) return entry.key;
    }
    return availableSpecialPoolKeys[availableSpecialPoolKeys.length - 1]?.key || null;
  };

  const isLegacyPack = setId && LEGACY_SETS.includes(setId);
  const legacyHitRare = !isLegacyPack || Math.random() < 0.15;

  let rareSlotCard = null;
  if (legacyHitRare && hitSpecialTable && availableSpecialPoolKeys.length) {
    const selectedPoolKey = pickWeightedSpecialPoolKey();
    if (selectedPoolKey) {
      rareSlotCard = getUniqueCard(specialPools[selectedPoolKey]);
    }
  }

  if (legacyHitRare && !rareSlotCard) {
    rareSlotCard = getUniqueCard(standardRares);
  }

  if (legacyHitRare && !rareSlotCard && availableSpecialPoolKeys.length) {
    for (const entry of availableSpecialPoolKeys) {
      rareSlotCard = getUniqueCard(specialPools[entry.key]);
      if (rareSlotCard) break;
    }
  }

  if (!legacyHitRare) {
    rareSlotCard = getUniqueCard(uncommons) || getUniqueCard(lowPool);
  }

  if (!rareSlotCard) {
    rareSlotCard = getUniqueCard(nonEnergyCards);
  }

  if (rareSlotCard) {
    pulledCards.push(rareSlotCard);
  }

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

    const { cards: allCards } = await getCardsForSet(setId);
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
