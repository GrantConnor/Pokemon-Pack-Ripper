import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { refreshAllUsersPointsIfDue, refreshUserPoints } from '@/lib/auth';
import { getBreakdownValueForRarity } from '@/lib/breakdown-values';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_RARITIES = [
  'Common',
  'Uncommon',
  'Rare Holo',
  'Rare Holo EX',
  'Rare Holo V',
  'Rare Holo VMAX',
  'Double Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Ultra Rare',
  'Rare Ultra',
  'Rare Rainbow',
  'Hyper Rare',
  'Secret Rare',
  'Rare Secret',
  'Amazing Rare',
  'Rare BREAK',
  'Rare Prism Star',
  'ACE SPEC Rare',
  'Rare Shiny',
  'Shiny Rare',
  'Radiant Rare',
  'LEGEND',
  'Rare Holo Star',
];

export async function POST(request) {
  try {
    const { userId, mode, rarities = [], selectedCardIds = [] } = await request.json();
    if (!userId || !mode) {
      return NextResponse.json({ error: 'User ID and mode are required' }, { status: 400 });
    }

    const filteredRarities = Array.from(new Set((Array.isArray(rarities) ? rarities : []).filter((rarity) => ALLOWED_RARITIES.includes(rarity))));
    if (!filteredRarities.length) {
      return NextResponse.json({ error: 'At least one eligible rarity must be selected' }, { status: 400 });
    }

    if (!['duplicates', 'selected', 'all'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid breakdown mode' }, { status: 400 });
    }

    const database = await connectDB();
    await refreshAllUsersPointsIfDue(database);
    const users = database.collection('users');
    let user = await users.findOne({ id: userId }, { projection: { _id: 1, id: 1, username: 1, points: 1, createdAt: 1, lastPointsRefresh: 1, collection: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user = await refreshUserPoints(users, user);

    const collection = Array.isArray(user.collection) ? user.collection : [];
    const allowedSet = new Set(filteredRarities);
    const cardsToBreakdown = [];

    if (mode === 'duplicates') {
      const grouped = new Map();
      for (const card of collection) {
        if (!grouped.has(card.id)) grouped.set(card.id, []);
        grouped.get(card.id).push(card);
      }

      for (const cards of grouped.values()) {
        const sortedCards = [...cards].sort((a, b) => new Date(a.pulledAt || 0) - new Date(b.pulledAt || 0));
        const eligibleDuplicates = sortedCards.slice(1).filter((card) => allowedSet.has(card.rarity || 'Common'));
        cardsToBreakdown.push(...eligibleDuplicates);
      }
    }

    if (mode === 'selected') {
      const selectedSet = new Set((Array.isArray(selectedCardIds) ? selectedCardIds : []).filter(Boolean));
      if (!selectedSet.size) {
        return NextResponse.json({ error: 'No selected cards provided' }, { status: 400 });
      }

      const grouped = new Map();
      for (const card of collection) {
        if (!selectedSet.has(card.id)) continue;
        if (!grouped.has(card.id)) grouped.set(card.id, []);
        grouped.get(card.id).push(card);
      }

      for (const cards of grouped.values()) {
        if (cards.length <= 1) continue;
        const sortedCards = [...cards].sort((a, b) => new Date(a.pulledAt || 0) - new Date(b.pulledAt || 0));
        const eligibleDuplicate = sortedCards.slice(1).find((card) => allowedSet.has(card.rarity || 'Common'));
        if (eligibleDuplicate) {
          cardsToBreakdown.push(eligibleDuplicate);
        }
      }
    }

    if (mode === 'all') {
      for (const card of collection) {
        if (allowedSet.has(card.rarity || 'Common')) {
          cardsToBreakdown.push(card);
        }
      }
    }

    if (!cardsToBreakdown.length) {
      return NextResponse.json({ error: 'No eligible cards found to break down' }, { status: 400 });
    }

    const totalPoints = cardsToBreakdown.reduce((sum, card) => sum + getBreakdownValueForRarity(card.rarity), 0);

    await users.updateOne(
      { id: userId },
      {
        $pull: { collection: { $or: cardsToBreakdown.map((card) => ({ id: card.id, pulledAt: card.pulledAt })) } },
        $inc: { points: totalPoints },
      }
    );

    return NextResponse.json({
      success: true,
      cardsBreakdown: cardsToBreakdown.length,
      pointsAwarded: totalPoints,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to break down cards' }, { status: 500 });
  }
}
