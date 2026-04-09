import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { createSafariSpawn, getSafariCatchRate, SAFARI_BIOMES } from '@/lib/safari-zone';

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
    const instances = database.collection('safari_zone_instances');
    let instance = await instances.findOne({ userId });
    if (!instance) {
      return NextResponse.json({ error: 'No active Safari Zone run' }, { status: 404 });
    }

    const now = Date.now();
    if (instance.expiresAt && now >= instance.expiresAt) {
      await instances.deleteOne({ userId });
      return NextResponse.json({ error: 'Safari Zone run expired', expired: true }, { status: 404 });
    }

    const shouldRespawn = !instance.currentSpawn && instance.nextSpawnAt && now >= instance.nextSpawnAt;
    if (shouldRespawn) {
      const fallbackBiome = {
        key: instance.biomeKey,
        name: instance.biomeName,
        description: instance.biomeDescription,
        commons: [], uncommons: [], rares: [], legendaries: [], mythicals: []
      };
      const configuredBiome = SAFARI_BIOMES.find((entry) => entry.key === instance.biomeKey) || fallbackBiome;
      const newSpawn = await createSafariSpawn(configuredBiome, { shinyRate: instance.shinyRate || undefined });
      const currentSpawn = {
        ...newSpawn,
        spawnId: `${now}-${newSpawn.id}`,
        snackApplied: false,
        status: 'active',
      };
      await instances.updateOne(
        { userId },
        { $set: { currentSpawn, nextSpawnAt: null, updatedAt: now } }
      );
      instance = { ...instance, currentSpawn, nextSpawnAt: null };
    }

    const spawn = instance.currentSpawn
      ? {
          ...instance.currentSpawn,
          catchRate: getSafariCatchRate(instance.currentSpawn, instance.currentSpawn.snackApplied),
          attemptsUsed: instance.currentSpawn.attemptsUsed || 0,
          maxAttempts: instance.currentSpawn.maxAttempts || ((instance.currentSpawn.safariRarity === 'legendary' || instance.currentSpawn.safariRarity === 'mythical') ? 3 : 1),
        }
      : null;

    return NextResponse.json({
      success: true,
      safariZone: {
        biomeKey: instance.biomeKey,
        biomeName: instance.biomeName,
        biomeDescription: instance.biomeDescription,
        backgroundPath: instance.backgroundPath,
        snacksRemaining: instance.snacksRemaining ?? 0,
        createdAt: instance.createdAt,
        expiresAt: instance.expiresAt,
        shinyRate: instance.shinyRate || null,
      },
      spawn,
      nextSpawnAt: instance.nextSpawnAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load Safari Zone' }, { status: 500 });
  }
}
