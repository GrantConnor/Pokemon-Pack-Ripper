import axios from 'axios';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { fetchPokemonData, calculateStats, MAX_POKEMON_ID, normalizeStoredSprite } from '@/lib/wilds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

async function resolvePokemonIdFromQuery(query) {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const numericId = Number(raw);
    return numericId >= 1 && numericId <= MAX_POKEMON_ID ? numericId : null;
  }
  try {
    const response = await axios.get(`${POKEAPI_BASE}/pokemon/${encodeURIComponent(raw)}`);
    return response.data?.id || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const { adminId, pokemonId } = await request.json();
    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const admin = await database.collection('users').findOne({ id: adminId }, { projection: { id: 1, username: 1 } });
    if (!admin || admin.username !== 'Spheal') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const resolvedPokemonId = await resolvePokemonIdFromQuery(pokemonId);
    if (pokemonId && !resolvedPokemonId) {
      return NextResponse.json({ error: 'Could not find a Pokémon matching that dex number or name' }, { status: 404 });
    }

    const spawnId = resolvedPokemonId || (Math.floor(Math.random() * MAX_POKEMON_ID) + 1);
    const pokemonData = await fetchPokemonData(spawnId, true);
    pokemonData.level = Math.floor(Math.random() * 46) + 5;
    pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);

    const newSpawn = {
      id: 'current',
      pokemon: normalizeStoredSprite({ ...pokemonData, id: spawnId, isShiny: true }),
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

    return NextResponse.json({
      success: true,
      spawn: newSpawn,
      resolvedPokemonId: spawnId,
      message: `Spawned SHINY ${newSpawn.pokemon.displayName} (#${spawnId})! ✨`,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to spawn shiny Pokémon' }, { status: 500 });
  }
}
