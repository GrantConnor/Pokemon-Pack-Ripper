import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { randomSafariSpawnDelay } from '@/lib/safari-zone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const instances = database.collection('safari_zone_instances');
    const instance = await instances.findOne({ userId });
    if (!instance || !instance.currentSpawn) {
      return NextResponse.json({ error: 'No Safari Zone Pokémon available' }, { status: 404 });
    }

    const spawn = instance.currentSpawn;
    const nextSpawnAt = Date.now() + randomSafariSpawnDelay();

    const result = await instances.updateOne(
      { userId, 'currentSpawn.spawnId': spawn.spawnId },
      {
        $set: {
          currentSpawn: null,
          nextSpawnAt,
          updatedAt: Date.now(),
        },
      }
    );

    if (!result.modifiedCount) {
      return NextResponse.json({ error: 'That Safari Zone Pokémon is no longer available' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      nextSpawnAt,
      message: `You ran from ${spawn.displayName}.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to run from Safari Zone Pokémon' }, { status: 500 });
  }
}
