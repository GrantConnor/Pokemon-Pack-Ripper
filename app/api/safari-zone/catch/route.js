import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSafariCatchRate, randomSafariSpawnDelay } from '@/lib/safari-zone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const database = await connectDB();
    const instances = database.collection('safari_zone_instances');
    const instance = await instances.findOne({ userId });
    if (!instance || !instance.currentSpawn) return NextResponse.json({ error: 'No Safari Zone Pokémon available' }, { status: 404 });

    const spawn = instance.currentSpawn;
    const catchRate = getSafariCatchRate(spawn, spawn.snackApplied);
    const caught = Math.random() * 100 < catchRate;
    const isSpecial = spawn.safariRarity === 'legendary' || spawn.safariRarity === 'mythical';
    const maxAttempts = isSpecial ? 3 : 1;
    const attemptsUsed = (spawn.attemptsUsed || 0) + 1;
    const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);

    if (caught) {
      const nextSpawnAt = Date.now() + randomSafariSpawnDelay();
      const logEntry = {
        displayName: spawn.displayName,
        sprite: spawn.sprite,
        catchRate,
        outcome: 'caught',
        isShiny: !!spawn.isShiny,
        safariRarity: spawn.safariRarity,
        createdAt: Date.now(),
      };
      const claimResult = await instances.updateOne(
        { userId, 'currentSpawn.spawnId': spawn.spawnId },
        { $set: { currentSpawn: null, nextSpawnAt, updatedAt: Date.now() }, $push: { encounterLog: logEntry } }
      );
      if (!claimResult.modifiedCount) return NextResponse.json({ error: 'That Safari Zone Pokémon is no longer available' }, { status: 409 });

      const caughtPokemon = { ...spawn, userId, caughtAt: new Date().toISOString(), currentXP: 0 };
      for (const key of ['spawnId', 'snackApplied', 'status', 'catchRate', 'attemptsUsed', 'maxAttempts']) delete caughtPokemon[key];
      await database.collection('caught_pokemon').insertOne(caughtPokemon);
      return NextResponse.json({ success: true, caught: true, pokemon: caughtPokemon, nextSpawnAt, message: `You caught ${spawn.displayName}!` });
    }

    if (attemptsRemaining > 0) {
      const updatedSpawn = { ...spawn, attemptsUsed, maxAttempts };
      const retryResult = await instances.updateOne(
        { userId, 'currentSpawn.spawnId': spawn.spawnId },
        { $set: { currentSpawn: updatedSpawn, updatedAt: Date.now() } }
      );
      if (!retryResult.modifiedCount) return NextResponse.json({ error: 'That Safari Zone Pokémon is no longer available' }, { status: 409 });
      return NextResponse.json({ success: true, caught: false, escaped: false, spawn: { ...updatedSpawn, catchRate }, attemptsRemaining, message: `${spawn.displayName} broke free! ${attemptsRemaining} catch ${attemptsRemaining === 1 ? 'try' : 'tries'} remaining.` });
    }

    const nextSpawnAt = Date.now() + randomSafariSpawnDelay();
    const logEntry = {
      displayName: spawn.displayName,
      sprite: spawn.sprite,
      catchRate,
      outcome: 'got-away',
      isShiny: !!spawn.isShiny,
      safariRarity: spawn.safariRarity,
      createdAt: Date.now(),
    };
    const claimResult = await instances.updateOne(
      { userId, 'currentSpawn.spawnId': spawn.spawnId },
      { $set: { currentSpawn: null, nextSpawnAt, updatedAt: Date.now() }, $push: { encounterLog: logEntry } }
    );
    if (!claimResult.modifiedCount) return NextResponse.json({ error: 'That Safari Zone Pokémon is no longer available' }, { status: 409 });
    return NextResponse.json({ success: true, caught: false, escaped: true, nextSpawnAt, catchRate, attemptsRemaining: 0, message: `${spawn.displayName} got away!` });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed Safari Zone catch attempt' }, { status: 500 });
  }
}
