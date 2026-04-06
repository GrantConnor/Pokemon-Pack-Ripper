import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { fromId, toId, offeredPokemon, requestedPokemon, type } = await request.json();
    if (!fromId || !toId || !offeredPokemon || !requestedPokemon) {
      return NextResponse.json({ error: 'Invalid trade request' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const [fromUser, toUser] = await Promise.all([
      users.findOne({ id: fromId }, { projection: { id: 1, username: 1 } }),
      users.findOne({ id: toId }, { projection: { id: 1, username: 1 } }),
    ]);

    if (!fromUser || !toUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tradeRequest = {
      id: uuidv4(),
      fromId,
      fromUsername: fromUser.username,
      toId,
      toUsername: toUser.username,
      offeredPokemon,
      requestedPokemon,
      type: type || 'pokemon-trade',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await users.updateOne({ id: toId }, { $push: { tradeRequests: tradeRequest } });
    return NextResponse.json({ success: true, message: `Trade request sent to ${toUser.username}`, trade: tradeRequest });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to send Pokémon trade request' }, { status: 500 });
  }
}
