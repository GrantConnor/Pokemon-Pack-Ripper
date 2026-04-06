import { NextResponse } from 'next/server';
import { getCardsForSet } from '@/lib/pokemon-tcg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');
    if (!setId) {
      return NextResponse.json({ error: 'Set ID required' }, { status: 400 });
    }

    const { cards, cached } = await getCardsForSet(setId);
    return NextResponse.json({ cards, cached });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load cards' }, { status: 500 });
  }
}
