import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { pickSafariBiome, SAFARI_SNACKS_PER_RUN, SAFARI_ZONE_COST, SAFARI_DURATION_MS, SAFARI_SHINY_RATE, createSafariSpawn } from '@/lib/safari-zone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const user = await database.collection('users').findOne({ id: userId }, { projection: { id: 1, points: 1, username: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if ((user.points || 0) < SAFARI_ZONE_COST) {
      return NextResponse.json({ error: `You need ${SAFARI_ZONE_COST} points to enter the Safari Zone` }, { status: 400 });
    }

    const biome = pickSafariBiome();
    const shinyRate = user.username === 'Spheal' ? 1 / 5 : SAFARI_SHINY_RATE;
    const initialSpawn = await createSafariSpawn(biome, { shinyRate });
    const now = Date.now();
    const instance = {
      userId,
      biomeKey: biome.key,
      biomeName: biome.name,
      biomeDescription: biome.description,
      backgroundPath: biome.backgroundPath,
      snacksRemaining: SAFARI_SNACKS_PER_RUN,
      createdAt: now,
      expiresAt: now + SAFARI_DURATION_MS,
      shinyRate,
      currentSpawn: {
        ...initialSpawn,
        spawnId: `${now}-${initialSpawn.id}`,
        snackApplied: false,
        status: 'active',
      },
      encounterLog: [],
      nextSpawnAt: null,
      updatedAt: now,
    };

    await database.collection('users').updateOne({ id: userId }, { $inc: { points: -SAFARI_ZONE_COST } });
    await database.collection('safari_zone_instances').updateOne(
      { userId },
      { $set: instance },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      safariZone: instance,
      pointsRemaining: Math.max(0, (user.points || 0) - SAFARI_ZONE_COST),
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to enter Safari Zone' }, { status: 500 });
  }
}
