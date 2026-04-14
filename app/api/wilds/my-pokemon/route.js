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
    const caughtPokemon = await database.collection('caught_pokemon')
      .find({ userId })
      .sort({ caughtAt: -1 })
      .toArray();

    const fixedPokemon = caughtPokemon.map((pokemon) => {
      const normalizedPokemon = normalizeStoredSprite(pokemon);

      const safeIvs = normalizedPokemon.ivs || {
        hp: 0,
        attack: 0,
        defense: 0,
        spAttack: 0,
        spDefense: 0,
        speed: 0,
      };

      const safeBaseStats = normalizedPokemon.baseStats || {
        hp: 100,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 100,
      };

      const level = normalizedPokemon.level || 50;
      const stats = normalizedPokemon.stats || calculateStats(
        safeBaseStats,
        safeIvs,
        level
      );

      return {
        ...normalizedPokemon,
        ivs: safeIvs,
        baseStats: safeBaseStats,
        level,
        stats,
        currentXP: normalizedPokemon.currentXP || 0,
        moveset: Array.isArray(normalizedPokemon.moveset) ? normalizedPokemon.moveset : [],
        allMoves: Array.isArray(normalizedPokemon.allMoves) ? normalizedPokemon.allMoves : [],
        allMovesData: Array.isArray(normalizedPokemon.allMovesData) ? normalizedPokemon.allMovesData : [],
      };
    });

    await persistNormalizedPokemonSprites(database, fixedPokemon);

    return NextResponse.json({ pokemon: fixedPokemon });
  } catch (error) {
    console.error('Error in /api/wilds/my-pokemon:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load caught Pokémon' },
      { status: 500 }
    );
  }
}
