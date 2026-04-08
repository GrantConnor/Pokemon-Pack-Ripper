import { connectDB } from '../../lib/mongodb.js';
import { refreshAllUsersPointsIfDue } from '../../lib/auth.js';

export default async () => {
  try {
    const db = await connectDB();
    const result = await refreshAllUsersPointsIfDue(db);

    return new Response(JSON.stringify({
      ok: true,
      scheduled: true,
      ...result,
      ranAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      scheduled: true,
      error: error?.message || 'Points sweep failed',
      ranAt: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  schedule: '*/5 * * * *',
};
