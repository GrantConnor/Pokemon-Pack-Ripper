import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slimCard(card) {
  return {
    id: card?.id,
    name: card?.name,
    rarity: card?.rarity,
    supertype: card?.supertype,
    subtypes: card?.subtypes || [],
    types: card?.types || [],
    set: card?.set
      ? {
          id: card.set.id,
          name: card.set.name,
          series: card.set.series,
        }
      : null,
    images: card?.images
      ? {
          small: card.images.small,
          large: card.images.large,
        }
      : null,
    isReverseHolo: !!card?.isReverseHolo,
    pulledAt: card?.pulledAt || null,
    viewed: !!card?.viewed,
    packNumber: card?.packNumber || 1,
  };
}

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
      { projection: { collection: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const collection = Array.isArray(user.collection) ? user.collection.map(slimCard) : [];

    return NextResponse.json({ collection });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load collection' }, { status: 500 });
  }
}
