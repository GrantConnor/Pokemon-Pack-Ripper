import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSafariCatchRate, randomSafariSpawnDelay } from '@/lib/safari-zone';

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
    const catchRate = getSafariCatchRate(spawn, spawn.snackApplied);
    const caught = Math.random() * 100 < catchRate;
    const nextSpawnAt = Date.now() + randomSafariSpawnDelay();

    const claimResult = await instances.updateOne(
      { userId, 'currentSpawn.spawnId': spawn.spawnId },
      {
        $set: {
          currentSpawn: null,
          nextSpawnAt,
          updatedAt: Date.now(),
        },
      }
    );

    if (!claimResult.modifiedCount) {
      return NextResponse.json({ error: 'That Safari Zone Pokémon is no longer available' }, { status: 409 });
    }

    if (caught) {
      const caughtPokemon = {
        ...spawn,
        userId,
        caughtAt: new Date().toISOString(),
        currentXP: 0,
      };
      delete caughtPokemon.spawnId;
      delete caughtPokemon.snackApplied;
      delete caughtPokemon.status;
      delete caughtPokemon.catchRate;

      await database.collection('caught_pokemon').insertOne(caughtPokemon);

      return NextResponse.json({
        success: true,
        caught: true,
        pokemon: caughtPokemon,
        nextSpawnAt,
        message: `You caught ${spawn.displayName}!`,
      });
    }

    return NextResponse.json({
      success: true,
      caught: false,
      nextSpawnAt,
      catchRate,
      message: `${spawn.displayName} got away!`,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed Safari Zone catch attempt' }, { status: 500 });
  }
}
