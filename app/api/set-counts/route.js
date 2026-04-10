import { NextResponse } from 'next/server';
import { getCardsForSet } from '@/lib/pokemon-tcg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';
    const ids = Array.from(new Set(idsParam.split(',').map((id) => id.trim()).filter(Boolean))).slice(0, 250);

    if (!ids.length) {
      return NextResponse.json({ counts: {} });
    }

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const { cards } = await getCardsForSet(id);
          return [id, Array.isArray(cards) ? cards.length : 0];
        } catch {
          return [id, null];
        }
      })
    );

    return NextResponse.json({ counts: Object.fromEntries(results) });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load set counts' }, { status: 500 });
  }
}
