import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;

let cachedClient = globalThis.__pokemonMongoClient || null;
let cachedDb = globalThis.__pokemonMongoDb || null;

export function getSanitizedMongoConfig() {
  return {
    hasMongoUrl: !!MONGO_URL,
    hasDbName: !!DB_NAME,
    dbName: DB_NAME || null,
    mongoUrlHost: MONGO_URL ? MONGO_URL.replace(/^(mongodb(?:\+srv)?:\/\/)([^@]+)@/, '$1***@') : null,
  };
}

export async function connectDB() {
  if (!MONGO_URL) {
    throw new Error('Missing MONGO_URL environment variable on Netlify');
  }

  if (!DB_NAME) {
    throw new Error('Missing DB_NAME environment variable on Netlify');
  }

  if (cachedDb) {
    return cachedDb;
  }

  const client = cachedClient || new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  await client.connect();

  const db = client.db(DB_NAME);
  await db.command({ ping: 1 });

  cachedClient = client;
  cachedDb = db;
  globalThis.__pokemonMongoClient = client;
  globalThis.__pokemonMongoDb = db;

  try {
    await db.collection('users').createIndex({ normalizedUsername: 1 }, { sparse: true });
  } catch (error) {
    console.error('[DB] Failed creating normalizedUsername index:', error?.message || error);
  }

  return db;
}
