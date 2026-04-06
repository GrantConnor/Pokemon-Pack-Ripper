import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BREAKDOWN_VALUES = {
  'Common': 10,
  'Uncommon': 20,
  'Rare': 50,
  'Rare Holo': 50,
  'Double Rare': 100,
  'Illustration Rare': 200,
  'Ultra Rare': 200,
  'Rare Ultra': 200,
  'Rare Rainbow': 200,
  'Special Illustration Rare': 400,
  'Hyper Rare': 500,
  'Rare Secret': 500,
  'Secret Rare': 500,
};

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const user = await users.findOne({ id: userId }, { projection: { collection: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const collection = Array.isArray(user.collection) ? user.collection : [];
    const grouped = new Map();

    for (const card of collection) {
      if (!grouped.has(card.id)) grouped.set(card.id, []);
      grouped.get(card.id).push(card);
    }

    const cardsToBreakdown = [];
    let totalPoints = 0;

    for (const cards of grouped.values()) {
      if (cards.length <= 1) continue;
      const sortedCards = [...cards].sort((a, b) => new Date(a.pulledAt || 0) - new Date(b.pulledAt || 0));
      const duplicates = sortedCards.slice(1); // leave the oldest copy
      cardsToBreakdown.push(...duplicates);
      for (const card of duplicates) {
        totalPoints += BREAKDOWN_VALUES[card.rarity] || 10;
      }
    }

    if (!cardsToBreakdown.length) {
      return NextResponse.json({ error: 'No duplicate cards available to break down' }, { status: 400 });
    }

    await users.updateOne(
      { id: userId },
      {
        $pull: { collection: { $or: cardsToBreakdown.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } },
        $inc: { points: totalPoints },
      }
    );

    return NextResponse.json({
      success: true,
      cardsBreakdown: cardsToBreakdown.length,
      pointsAwarded: totalPoints,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to break down duplicate cards' }, { status: 500 });
  }
}
