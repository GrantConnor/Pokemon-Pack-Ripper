import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getSafariCatchRate } from '@/lib/safari-zone';

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
      return NextResponse.json({ error: 'No active Safari Zone spawn' }, { status: 404 });
    }
    if ((instance.snacksRemaining ?? 0) <= 0) {
      return NextResponse.json({ error: 'No Poké Snacks remaining' }, { status: 400 });
    }
    if (instance.currentSpawn.snackApplied) {
      return NextResponse.json({ error: 'A snack has already been used on this Pokémon' }, { status: 400 });
    }

    const snacksRemaining = Math.max(0, (instance.snacksRemaining ?? 0) - 1);
    const currentSpawn = { ...instance.currentSpawn, snackApplied: true };
    await instances.updateOne(
      { userId, 'currentSpawn.spawnId': instance.currentSpawn.spawnId },
      { $set: { currentSpawn, snacksRemaining, updatedAt: Date.now() } }
    );

    return NextResponse.json({
      success: true,
      snacksRemaining,
      spawn: { ...currentSpawn, catchRate: getSafariCatchRate(currentSpawn, true) },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to use Poké Snack' }, { status: 500 });
  }
}
