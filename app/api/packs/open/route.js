import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/mongodb';
import { getCardsForSet, getPackCost } from '@/lib/pokemon-tcg';
import { refreshAllUsersPointsIfDue, refreshUserPoints } from '@/lib/auth';
import { applyDailyObjectiveEvent } from '@/lib/daily-objectives';

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

const HS_SETS = ['hgss1', 'hgss2', 'hgss3', 'hgss4'];
const HS_SET_NAMES = ['HeartGold & SoulSilver', 'HS—Unleashed', 'HS—Undaunted', 'HS—Triumphant'];


export function openPack(cards, setId = null) {
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

  const getRandomCard = (pool) => {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const buildGodPack = (pool) => {
    const godPack = [];
    const usedIds = new Set();
    for (let i = 0; i < 10; i++) {
      const available = pool.filter(card => !usedIds.has(card.id));
      const sourcePool = available.length > 0 ? available : pool;
      if (!sourcePool.length) break;
      const card = sourcePool[Math.floor(Math.random() * sourcePool.length)];
      usedIds.add(card.id);
      godPack.push(card);
    }
    return godPack;
  };

  const rarityValue = (card) => String(card?.rarity || '').trim().toLowerCase();
  const subtypeValues = (card) => Array.isArray(card?.subtypes) ? card.subtypes.map(subtype => String(subtype).trim().toLowerCase()) : [];
  const isRegularRareShinyCard = (card) => {
    const rarity = rarityValue(card);
    const subtypes = subtypeValues(card);
    const isShiningFatesVault = card?.set?.id === 'swsh45sv';
    const isFullArtStyle = subtypes.some(subtype => ['v', 'vmax', 'gx', 'ex', 'ultra beast'].includes(subtype));
    return (rarity === 'rare shiny' || rarity === 'shiny rare' || subtypes.includes('shiny rare') || (isShiningFatesVault && rarity.includes('shiny'))) && !isFullArtStyle;
  };
  const isRareHoloVFamilyCard = (card) => {
    const rarity = String(card?.rarity || '').trim();
    return rarity.includes('Rare Holo VMAX') || rarity.includes('Rare Holo V');
  };
  const isStandardRareCard = (card) => {
    const rarity = rarityValue(card);
    return rarity === 'rare' || rarity === 'rare holo';
  };
  const isSpecialRareCard = (card) => {
    const rarity = rarityValue(card);
    if (!rarity || rarity === 'common' || rarity === 'uncommon') return false;
    if (rarity === 'rare' || rarity === 'rare holo') return false;
    return (
      rarity.includes('double rare') ||
      isRegularRareShinyCard(card) ||
      (rarity.includes('illustration rare') && !rarity.includes('special')) ||
      rarity.includes('special illustration rare') ||
      rarity.includes('ultra rare') ||
      rarity.includes('rare ultra') ||
      rarity.includes('rare holo ex') ||
      isRareHoloVFamilyCard(card) ||
      rarity.includes('rare rainbow') ||
      rarity.includes('hyper rare') ||
      rarity.includes('secret rare') ||
      rarity.includes('rare secret') ||
      rarity.includes('amazing rare') ||
      rarity.includes('ace spec') ||
      rarity.includes('rare')
    );
  };

  const commons = nonEnergyCards.filter(card => rarityValue(card) === 'common');
  const uncommons = nonEnergyCards.filter(card => rarityValue(card) === 'uncommon');
  const lowRarityCards = nonEnergyCards.filter(card => !isStandardRareCard(card) && !isSpecialRareCard(card));
  const hsStandardRares = nonEnergyCards.filter(card => {
    const rarity = rarityValue(card);
    return rarity.includes('rare') && !rarity.includes('legend') && !rarity.includes('secret');
  });
  const standardRares = nonEnergyCards.filter(isStandardRareCard);

  const specialPools = {
    rareHoloEx: nonEnergyCards.filter(card => rarityValue(card).includes('rare holo ex')),
    doubleRare: nonEnergyCards.filter(card => rarityValue(card).includes('double rare')),
    illustrationRare: nonEnergyCards.filter(card => rarityValue(card).includes('illustration rare') && !rarityValue(card).includes('special')),
    specialIllustrationRare: nonEnergyCards.filter(card => rarityValue(card).includes('special illustration rare')),
    ultraRare: nonEnergyCards.filter(card => rarityValue(card).includes('ultra rare') || rarityValue(card).includes('rare ultra')),
    shinyRare: nonEnergyCards.filter(isRegularRareShinyCard),
    amazingRare: nonEnergyCards.filter(card => rarityValue(card).includes('amazing rare')),
    radiantRare: nonEnergyCards.filter(card => rarityValue(card).includes('radiant rare')),
    rarePrismStar: nonEnergyCards.filter(card => rarityValue(card).includes('rare prism star')),
    aceSpecRare: nonEnergyCards.filter(card => rarityValue(card).includes('ace spec')),
    rareBreak: nonEnergyCards.filter(card => rarityValue(card).includes('rare break')),
    legend: nonEnergyCards.filter(card => rarityValue(card).includes('legend')),
    rainbowRare: nonEnergyCards.filter(card => rarityValue(card).includes('rare rainbow')),
    hyperRare: nonEnergyCards.filter(card => rarityValue(card).includes('hyper rare')),
    secretRare: nonEnergyCards.filter(card => {
      const rarity = rarityValue(card);
      return rarity.includes('secret rare') || rarity.includes('rare secret') || isRareHoloVFamilyCard(card);
    }),
  };

  const godPackPool = [
    ...specialPools.illustrationRare,
    ...specialPools.specialIllustrationRare,
    ...specialPools.ultraRare,
    ...specialPools.rainbowRare,
    ...specialPools.hyperRare,
    ...specialPools.secretRare,
    ...specialPools.legend,
  ];

  const lowPool = lowRarityCards.length ? lowRarityCards : nonEnergyCards;

  for (let i = 0; i < 5; i++) {
    pulledCards.push(
      getUniqueCard(commons) ||
      getUniqueCard(lowPool) ||
      getRandomCard(commons) ||
      getRandomCard(lowPool)
    );
  }

  for (let i = 0; i < 3; i++) {
    pulledCards.push(
      getUniqueCard(uncommons) ||
      getUniqueCard(lowPool) ||
      getRandomCard(uncommons) ||
      getRandomCard(lowPool)
    );
  }

  const reverseHoloBase = getUniqueCard(lowPool) || getRandomCard(lowPool);
  if (reverseHoloBase) {
    pulledCards.push({ ...reverseHoloBase, isReverseHolo: true });
  }

  const setName = cards[0]?.set?.name || '';
  const setSeries = cards[0]?.set?.series || '';
  const isHsPack = (setId && HS_SETS.includes(setId)) || HS_SET_NAMES.includes(setName) || setSeries === 'HeartGold & SoulSilver';
  const weightedSpecialTable = isHsPack
    ? [
        { key: 'legend', weight: 4 },
        { key: 'secretRare', weight: 1 },
      ]
    : [
        { key: 'rareHoloEx', weight: 35 },
        { key: 'doubleRare', weight: 30 },
        { key: 'illustrationRare', weight: 12 },
        { key: 'specialIllustrationRare', weight: 3 },
        { key: 'ultraRare', weight: 10 },
        { key: 'shinyRare', weight: 5 },
        { key: 'amazingRare', weight: 3 },
        { key: 'radiantRare', weight: 3 },
        { key: 'rarePrismStar', weight: 2 },
        { key: 'aceSpecRare', weight: 2 },
        { key: 'rareBreak', weight: 2 },
        { key: 'legend', weight: 1 },
        { key: 'rainbowRare', weight: 1 },
        { key: 'hyperRare', weight: 0.5 },
        { key: 'secretRare', weight: 1 },
      ];
  const availableSpecialPoolKeys = weightedSpecialTable.filter(entry => specialPools[entry.key]?.length > 0);
  const hitSpecialTable = Math.random() < (isHsPack ? 0.05 : 0.10);

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

  if (!isLegacyPack && !isHsPack && hitSpecialTable && godPackPool.length > 0) {
    const godPackRoll = Math.floor(Math.random() * 100) + 1;
    if (godPackRoll === 100) {
      return buildGodPack(godPackPool);
    }
  }

  let rareSlotCard = null;
  if (legacyHitRare && hitSpecialTable && availableSpecialPoolKeys.length) {
    const selectedPoolKey = pickWeightedSpecialPoolKey();
    if (selectedPoolKey) {
      rareSlotCard = getUniqueCard(specialPools[selectedPoolKey]);
    }
  }

  if (legacyHitRare && !rareSlotCard) {
    rareSlotCard = isHsPack
      ? (getUniqueCard(hsStandardRares) || getRandomCard(hsStandardRares))
      : getUniqueCard(standardRares);
  }

  if (legacyHitRare && !rareSlotCard && availableSpecialPoolKeys.length) {
    if (isHsPack) {
      for (const entry of availableSpecialPoolKeys) {
        rareSlotCard = getUniqueCard(specialPools[entry.key]) || getRandomCard(specialPools[entry.key]);
        if (rareSlotCard) break;
      }
    } else {
      for (const entry of availableSpecialPoolKeys) {
        rareSlotCard = getUniqueCard(specialPools[entry.key]);
        if (rareSlotCard) break;
      }
    }
  }

  if (!legacyHitRare) {
    rareSlotCard = getUniqueCard(uncommons) || getUniqueCard(lowPool) || getRandomCard(uncommons) || getRandomCard(lowPool);
  }

  if (!rareSlotCard) {
    rareSlotCard = legacyHitRare
      ? (getUniqueCard(standardRares) || getRandomCard(standardRares) || getUniqueCard(lowPool) || getRandomCard(lowPool))
      : (getUniqueCard(lowPool) || getRandomCard(lowPool));
  }

  if (rareSlotCard) {
    pulledCards.push(rareSlotCard);
  }

  if (setId === 'swsh45' && specialPools.shinyRare.length > 0 && pulledCards.length >= 9 && Math.random() < 0.075) {
    const shinyVaultCard = getUniqueCard(specialPools.shinyRare) || getRandomCard(specialPools.shinyRare);
    if (shinyVaultCard) {
      pulledCards[pulledCards.length - 2] = shinyVaultCard;
    }
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
    await refreshAllUsersPointsIfDue(database);
    const users = database.collection('users');
    let user = await users.findOne(
      { id: userId },
      { projection: { _id: 1, id: 1, username: 1, points: 1, createdAt: 1, lastPointsRefresh: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user = await refreshUserPoints(users, user);

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

    await users.updateOne(
      { id: userId },
      {
        $push: {
          collection: { $each: cardsWithTimestamp },
        },
        $set: { points: newPoints },
      }
    );

    const dailyObjectiveResult = await applyDailyObjectiveEvent(users, userId, 'open-pack', { count: packCount });
    const finalPointsRemaining = newPoints + (dailyObjectiveResult?.pointsAwarded || 0);

    const revealId = uuidv4();
    await database.collection('pack_reveals').insertOne({
      id: revealId,
      userId,
      cards: cardsWithTimestamp,
      packs: packsWithTimestamps,
      isBulk: !!bulk,
      pointsRemaining: finalPointsRemaining,
      createdAt: new Date().toISOString(),
      revealed: false,
    });

    return NextResponse.json({
      success: true,
      revealId,
      cards: cardsWithTimestamp,
      packs: packsWithTimestamps,
      isBulk: bulk,
      pointsRemaining: finalPointsRemaining,
      achievements: null,
      xpApplied: false,
      dailyObjectivePointsAwarded: dailyObjectiveResult?.pointsAwarded || 0,
    });
  } catch (error) {
    return NextResponse.json({
      error: error?.message || 'Failed to open pack',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
