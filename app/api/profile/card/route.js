import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';
import { normalizeStoredSprite } from '@/lib/wilds';
import { getActiveDisplayTitle, getSelectedUnlockedTitle } from '@/lib/set-titles';

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
    const user = await database.collection('users').findOne(
      { id: userId },
      { projection: { id: 1, username: 1, battleWins: 1, tradesCompleted: 1, favoritePokemonId: 1, unlockedTitles: 1, selectedTitleId: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let favoritePokemon = null;
    if (user.favoritePokemonId) {
      try {
        const favorite = await database.collection('caught_pokemon').findOne(
          { _id: new ObjectId(user.favoritePokemonId), userId: user.id }
        );
        if (favorite) {
          favoritePokemon = normalizeStoredSprite({
            _id: favorite._id,
            id: favorite.id,
            displayName: favorite.displayName,
            nickname: favorite.nickname || null,
            sprite: favorite.sprite,
            isShiny: favorite.isShiny,
            level: favorite.level,
            types: favorite.types || [],
          });
        }
      } catch {}
    }

    const unlockedTitles = user.unlockedTitles || [];
    const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, user.selectedTitleId);
    const activeTitle = getActiveDisplayTitle({
      battleWins: user.battleWins || 0,
      unlockedTitles,
      selectedTitleId: user.selectedTitleId,
    });

    return NextResponse.json({
      profileCard: {
        id: user.id,
        username: user.username,
        battleWins: user.battleWins || 0,
        tradesCompleted: user.tradesCompleted || 0,
        trainerRank: activeTitle,
        baseTrainerRank: getActiveDisplayTitle({ battleWins: user.battleWins || 0, unlockedTitles: [], selectedTitleId: null }),
        favoritePokemon,
        selectedTitle,
        selectedTitleId: user.selectedTitleId || null,
        unlockedTitles,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load player card' }, { status: 500 });
  }
}
