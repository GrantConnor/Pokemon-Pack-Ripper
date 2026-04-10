import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, pokemonId } = body || {};
    if (!userId || !pokemonId) {
      return NextResponse.json({ error: 'User ID and Pokemon ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const favoritePokemon = await database.collection('caught_pokemon').findOne({ _id: new ObjectId(pokemonId), userId });
    if (!favoritePokemon) {
      return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
    }

    await database.collection('users').updateOne(
      { id: userId },
      { $set: { favoritePokemonId: String(pokemonId) } }
    );

    return NextResponse.json({ success: true, favoritePokemonId: String(pokemonId) });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to set favorite Pokemon' }, { status: 500 });
  }
}
