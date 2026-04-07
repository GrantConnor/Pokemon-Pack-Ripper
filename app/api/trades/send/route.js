import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeTradeCards(cards) {
  if (!Array.isArray(cards)) return [];

  return cards
    .filter((card) => card && typeof card === 'object' && card.id)
    .map((card) => ({
      ...card,
      id: String(card.id),
      pulledAt: card.pulledAt || new Date().toISOString(),
    }));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, friendId, offeredCards, requestedCards } = body || {};

    if (!userId || !friendId || !offeredCards || !requestedCards) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!Array.isArray(offeredCards) || !Array.isArray(requestedCards)) {
      return NextResponse.json({ error: 'Cards must be arrays' }, { status: 400 });
    }

    if (offeredCards.length === 0 || offeredCards.length > 10) {
      return NextResponse.json({ error: 'Must offer 1-10 cards' }, { status: 400 });
    }

    if (requestedCards.length > 10) {
      return NextResponse.json({ error: 'Can request maximum 10 cards' }, { status: 400 });
    }

    if (requestedCards.length > 0 && offeredCards.length === 0) {
      return NextResponse.json({ error: 'Must offer cards to request cards' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');

    const [user, friend] = await Promise.all([
      users.findOne(
        { id: userId },
        {
          projection: {
            id: 1,
            username: 1,
            friends: 1,
          },
        }
      ),
      users.findOne(
        { id: friendId },
        {
          projection: {
            id: 1,
            username: 1,
          },
        }
      ),
    ]);

    if (!user || !friend) {
      return NextResponse.json({ error: 'User or friend not found' }, { status: 404 });
    }

    if (!Array.isArray(user.friends) || !user.friends.includes(friendId)) {
      return NextResponse.json({ error: 'Can only trade with friends' }, { status: 403 });
    }

    const safeOfferedCards = sanitizeTradeCards(offeredCards);
    const safeRequestedCards = sanitizeTradeCards(requestedCards);

    const tradeRequest = {
      id: uuidv4(),
      from: userId,
      fromUsername: user.username,
      to: friendId,
      toUsername: friend.username,
      offeredCards: safeOfferedCards,
      requestedCards: safeRequestedCards,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await users.updateOne(
      { id: friendId },
      { $push: { tradeRequests: tradeRequest } }
    );

    return NextResponse.json({
      success: true,
      message: `Trade request sent to ${friend.username}`,
      tradeRequestId: tradeRequest.id,
    });
  } catch (error) {
    console.error('[TRADES][SEND] Failed to send trade request:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send trade request' },
      { status: 500 }
    );
  }
}
