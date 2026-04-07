import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { fetchPokemonData, calculateStats, MAX_POKEMON_ID, normalizeStoredSprite } from '@/lib/wilds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { adminId } = await request.json();
    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const admin = await database.collection('users').findOne({ id: adminId }, { projection: { id: 1, username: 1 } });
    if (!admin || admin.username !== 'Spheal') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const randomId = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
    const pokemonData = await fetchPokemonData(randomId, true);
    pokemonData.level = Math.floor(Math.random() * 46) + 5;
    pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);

    const newSpawn = {
      id: 'current',
      pokemon: normalizeStoredSprite({ ...pokemonData, isShiny: true }),
      spawnedAt: Date.now(),
      nextSpawnTime: null,
      caughtBy: null,
      catchAttempts: {},
    };

    await database.collection('global_spawn').updateOne(
      { id: 'current' },
      { $set: newSpawn },
      { upsert: true }
    );

    return NextResponse.json({ success: true, spawn: newSpawn, message: `Spawned SHINY ${newSpawn.pokemon.displayName}! ✨` });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to spawn shiny Pokémon' }, { status: 500 });
  }
}
