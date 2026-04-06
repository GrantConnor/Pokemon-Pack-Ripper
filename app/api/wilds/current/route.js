import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { normalizeStoredSprite, updateGlobalSpawn } from '@/lib/wilds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await connectDB();
    const spawn = await updateGlobalSpawn(database);

    if (spawn.caughtBy) {
      return NextResponse.json({ spawn: null, nextSpawnTime: spawn.nextSpawnTime });
    }

    const normalizedSpawn = spawn?.pokemon ? { ...spawn, pokemon: normalizeStoredSprite(spawn.pokemon) } : spawn;
    if (normalizedSpawn?.pokemon?.sprite !== spawn?.pokemon?.sprite) {
      await database.collection('global_spawn').updateOne({ id: 'current' }, { $set: { pokemon: normalizedSpawn.pokemon } });
    }

    return NextResponse.json({ spawn: normalizedSpawn });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load current spawn' }, { status: 500 });
  }
}
