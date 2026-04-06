import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, tradeId } = await request.json();
    if (!userId || !tradeId) {
      return NextResponse.json({ error: 'User ID and Trade ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const user = await users.findOne({ id: userId }, { projection: { id: 1, username: 1, tradeRequests: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tradeRequest = user.tradeRequests?.find(t => t.id === tradeId);
    if (!tradeRequest) {
      return NextResponse.json({ error: 'Trade request not found' }, { status: 404 });
    }

    const fromPokemonId = tradeRequest.offeredPokemon?.[0]?.pokemonId;
    const toPokemonId = tradeRequest.requestedPokemon?.[0]?.pokemonId;
    if (!fromPokemonId || !toPokemonId) {
      return NextResponse.json({ error: 'Invalid Pokémon trade payload' }, { status: 400 });
    }

    const caught = database.collection('caught_pokemon');
    const [fromPokemon, toPokemon] = await Promise.all([
      caught.findOne({ _id: new ObjectId(fromPokemonId), userId: tradeRequest.fromId }),
      caught.findOne({ _id: new ObjectId(toPokemonId), userId }),
    ]);

    if (!fromPokemon || !toPokemon) {
      return NextResponse.json({ error: 'One or both Pokémon not found' }, { status: 404 });
    }

    await Promise.all([
      caught.updateOne({ _id: fromPokemon._id }, { $set: { userId } }),
      caught.updateOne({ _id: toPokemon._id }, { $set: { userId: tradeRequest.fromId } }),
      users.updateOne({ id: userId }, { $pull: { tradeRequests: { id: tradeId } }, $inc: { tradesCompleted: 1 } }),
      users.updateOne({ id: tradeRequest.fromId }, { $inc: { tradesCompleted: 1 } }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Trade completed! You received ${fromPokemon.displayName}`,
      receivedPokemon: fromPokemon.displayName,
      sentPokemon: toPokemon.displayName,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to accept Pokémon trade' }, { status: 500 });
  }
}
