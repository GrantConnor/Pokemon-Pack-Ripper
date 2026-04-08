import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, tradeId } = await request.json();
    if (!userId || !tradeId) {
      return NextResponse.json({ error: 'Invalid trade acceptance' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const user = await users.findOne({ id: userId }, { projection: { id: 1, tradeRequests: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trade = user.tradeRequests?.find(t => t.id === tradeId);
    if (!trade) {
      return NextResponse.json({ error: 'Trade request not found' }, { status: 404 });
    }

    const fromUser = await users.findOne({ id: trade.from }, { projection: { id: 1 } });
    if (!fromUser) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    await users.updateOne(
      { id: trade.from },
      { $pull: { collection: { $or: trade.offeredCards.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } } }
    );

    if (trade.requestedCards.length > 0) {
      await users.updateOne({ id: trade.from }, { $push: { collection: { $each: trade.requestedCards } } });
      await users.updateOne(
        { id: userId },
        { $pull: { collection: { $or: trade.requestedCards.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } } }
      );
    }

    await users.updateOne({ id: userId }, { $push: { collection: { $each: trade.offeredCards } } });
    await users.updateOne({ id: userId }, { $pull: { tradeRequests: { id: tradeId } } });
    await Promise.all([
      users.updateOne({ id: trade.from }, { $inc: { tradesCompleted: 1 } }),
      users.updateOne({ id: userId }, { $inc: { tradesCompleted: 1 } }),
    ]);

    return NextResponse.json({ success: true, message: `Trade completed with ${trade.fromUsername}` });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to accept trade' }, { status: 500 });
  }
}
