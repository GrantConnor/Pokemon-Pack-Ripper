import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slimCard(card, favoriteCardIds = []) {
  return {
    id: card?.id,
    name: card?.name,
    rarity: card?.rarity,
    supertype: card?.supertype,
    subtypes: card?.subtypes || [],
    types: card?.types || [],
    set: card?.set ? { id: card.set.id, name: card.set.name, series: card.set.series } : null,
    images: card?.images ? { small: card.images.small, large: card.images.large } : null,
    isReverseHolo: !!card?.isReverseHolo,
    pulledAt: card?.pulledAt || null,
    viewed: !!card?.viewed,
    packNumber: card?.packNumber || 1,
    favorite: favoriteCardIds.includes(card?.id),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const offset = Math.max(0, Number(searchParams.get('offset') || 0));
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : null;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const projection = limit
      ? { collection: { $slice: [offset, limit] }, favoriteCardIds: 1 }
      : { collection: 1, favoriteCardIds: 1 };

    const database = await connectDB();
    const user = await database.collection('users').findOne(
      { id: userId },
      { projection }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rawCollection = Array.isArray(user.collection) ? user.collection : [];
    const favoriteCardIds = Array.isArray(user.favoriteCardIds) ? user.favoriteCardIds : [];
    const collection = rawCollection.map(card => slimCard(card, favoriteCardIds));

    return NextResponse.json({
      collection,
      offset,
      limit,
      hasMore: limit ? rawCollection.length === limit : false,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load collection' }, { status: 500 });
  }
}
