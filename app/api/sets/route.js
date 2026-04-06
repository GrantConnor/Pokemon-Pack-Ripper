import { NextResponse } from 'next/server';
import { getSets } from '@/lib/pokemon-tcg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { sets, cached } = await getSets();
    return NextResponse.json({ sets, cached });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load sets' }, { status: 500 });
  }
}
