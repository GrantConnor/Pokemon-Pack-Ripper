import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { calculateStats, normalizeStoredSprite, persistNormalizedPokemonSprites } from '@/lib/wilds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const caughtPokemon = await database.collection('caught_pokemon').find({ userId }).sort({ caughtAt: -1 }).toArray();

    const fixedPokemon = caughtPokemon.map(pokemon => {
      const normalizedPokemon = normalizeStoredSprite(pokemon);
      if (!normalizedPokemon.level || !normalizedPokemon.stats) {
        const level = normalizedPokemon.level || 50;
        const stats = normalizedPokemon.stats || calculateStats(
          normalizedPokemon.baseStats || { hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 },
          normalizedPokemon.ivs,
          level
        );
        return { ...normalizedPokemon, level, stats };
      }
      return normalizedPokemon;
    });

    await persistNormalizedPokemonSprites(database, fixedPokemon);

    return NextResponse.json({ pokemon: fixedPokemon });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load caught Pokémon' }, { status: 500 });
  }
}
