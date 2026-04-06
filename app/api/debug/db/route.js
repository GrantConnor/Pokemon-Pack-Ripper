import { NextResponse } from 'next/server';
import { connectDB, getSanitizedMongoConfig } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await connectDB();
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    return NextResponse.json({
      ok: true,
      config: getSanitizedMongoConfig(),
      collections: collections.map((c) => c.name).slice(0, 20),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown database connection error',
      config: getSanitizedMongoConfig(),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
