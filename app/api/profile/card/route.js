import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';
import { normalizeStoredSprite } from '@/lib/wilds';
import { getActiveDisplayTitle, getAllAvailableTitles, getSelectedUnlockedTitle, slugifyTitleLabel, syncSetTitlesFromCollection, mergeAllSetTitles, mergeSpecialTitlesForUsername } from '@/lib/set-titles';
import { getCardsForSet, getSets } from '@/lib/pokemon-tcg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const editable = searchParams.get('editable') === '1';
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    let user = await users.findOne(
      { id: userId },
      { projection: { id: 1, username: 1, battleWins: 1, tradesCompleted: 1, favoritePokemonId: 1, favoriteCardId: 1, unlockedTitles: 1, selectedTitleId: 1, collection: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }


    try {
      const collection = Array.isArray(user.collection) ? user.collection : [];
      const setGroups = new Map();
      for (const card of collection) {
        const setId = card?.set?.id;
        if (!setId || !card?.id) continue;
        if (!setGroups.has(setId)) {
          setGroups.set(setId, {
            setId,
            uniqueIds: new Set(),
            storedTotal: Number(card?.set?.total || 0),
            storedPrintedTotal: Number(card?.set?.printedTotal || 0),
          });
        }
        setGroups.get(setId).uniqueIds.add(card.id);
      }

      const missingTitleSetIds = Array.from(setGroups.values())
        .filter((group) => {
          const hasFull = (user.unlockedTitles || []).some((title) => title?.id === `set-full-${group.setId}`);
          const hasMaster = (user.unlockedTitles || []).some((title) => title?.id === `set-master-${group.setId}`);
          if (hasFull && hasMaster) return false;
          const ownedCount = group.uniqueIds.size;
          const nearestKnownTarget = Math.max(group.storedPrintedTotal || 0, group.storedTotal || 0);
          return ownedCount >= Math.max(1, nearestKnownTarget - 8);
        })
        .map((group) => group.setId)
        .slice(0, 12);

      let setsCatalog = [];
      try {
        setsCatalog = (await getSets()).sets || [];
      } catch {
        setsCatalog = [];
      }

      const cardsBySetEntries = await Promise.all(
        missingTitleSetIds.map(async (setId) => {
          try {
            const { cards } = await getCardsForSet(setId);
            return [setId, cards || []];
          } catch {
            return [setId, []];
          }
        })
      );
      const cardsBySet = Object.fromEntries(cardsBySetEntries);

      const syncedTitles = syncSetTitlesFromCollection(user, setsCatalog, cardsBySet);
      if (JSON.stringify(syncedTitles.unlockedTitles) !== JSON.stringify(user.unlockedTitles || [])) {
        await users.updateOne(
          { id: userId },
          { $set: { unlockedTitles: syncedTitles.unlockedTitles } }
        );
        user = { ...user, unlockedTitles: syncedTitles.unlockedTitles };
      }
    } catch {
      // Never let title backfill failure break the player card.
    }

    let favoriteCard = null;
    if (user.favoriteCardId) {
      const collection = Array.isArray(user.collection) ? user.collection : [];
      const card = collection.find((item) => item?.id === user.favoriteCardId);
      if (card) {
        favoriteCard = {
          id: card.id,
          name: card.name,
          rarity: card.rarity,
          set: card.set ? { id: card.set.id, name: card.set.name, series: card.set.series } : null,
          images: card.images ? { small: card.images.small, large: card.images.large } : null,
        };
      }
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

    let computedUnlockedTitles = mergeSpecialTitlesForUsername(user.username, user.unlockedTitles || []);
    if (user.username === 'Spheal') {
      try {
        computedUnlockedTitles = mergeAllSetTitles(computedUnlockedTitles, (await getSets()).sets || []);
      } catch {}
    }
    if (JSON.stringify(computedUnlockedTitles) !== JSON.stringify(user.unlockedTitles || [])) {
      await users.updateOne({ id: userId }, { $set: { unlockedTitles: computedUnlockedTitles } });
    }
    user = { ...user, unlockedTitles: computedUnlockedTitles };


    const favoriteCardOptions = editable ? Array.from(new Map((Array.isArray(user.collection) ? user.collection : [])
      .filter((card) => card?.id && card?.name)
      .map((card) => [card.id, {
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        setName: card?.set?.name || '',
        image: card?.images?.small || null,
      }])).values())
      .sort((a, b) => a.name.localeCompare(b.name)) : [];

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
        favoriteCard,
        favoriteCardId: user.favoriteCardId || null,
        favoriteCardOptions,
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
