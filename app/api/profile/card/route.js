import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';
import { normalizeStoredSprite } from '@/lib/wilds';
import { getCardsForSet } from '@/lib/pokemon-tcg';
import { getActiveDisplayTitle, getAllAvailableTitles, getSelectedUnlockedTitle, slugifyTitleLabel, unlockSetTitlesForUser } from '@/lib/set-titles';

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
    const users = database.collection('users');
    let user = await users.findOne(
      { id: userId },
      { projection: { id: 1, username: 1, battleWins: 1, tradesCompleted: 1, favoritePokemonId: 1, unlockedTitles: 1, selectedTitleId: 1, collection: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }


    const setIdsToSync = Array.from(new Set((user.collection || []).map((card) => card?.set?.id).filter(Boolean)));
    for (const setId of setIdsToSync) {
      try {
        const { cards } = await getCardsForSet(setId);
        if (cards?.length) {
          await unlockSetTitlesForUser(users, userId, setId, cards[0]?.set?.name || setId, cards);
        }
      } catch (error) {
        console.error('[PLAYER CARD] Failed syncing set titles for', setId, error);
      }
    }

    user = await users.findOne(
      { id: userId },
      { projection: { id: 1, username: 1, battleWins: 1, tradesCompleted: 1, favoritePokemonId: 1, unlockedTitles: 1, selectedTitleId: 1, collection: 1 } }
    );

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
    const availableTitles = getAllAvailableTitles({ battleWins: user.battleWins || 0, unlockedTitles });
    const effectiveSelectedTitleId = user.selectedTitleId || `rank-${slugifyTitleLabel(getActiveDisplayTitle({ battleWins: user.battleWins || 0, unlockedTitles: [], selectedTitleId: null }).label)}`;
    const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, effectiveSelectedTitleId, user.battleWins || 0);
    const activeTitle = getActiveDisplayTitle({
      battleWins: user.battleWins || 0,
      unlockedTitles,
      selectedTitleId: effectiveSelectedTitleId,
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
        selectedTitleId: effectiveSelectedTitleId,
        unlockedTitles,
        availableTitles,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load player card' }, { status: 500 });
  }
}
