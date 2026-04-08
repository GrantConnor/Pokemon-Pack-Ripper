import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;

let cachedClient = globalThis.__pokemonMongoClient || null;
let cachedClientPromise = globalThis.__pokemonMongoClientPromise || null;
let cachedDbPromise = globalThis.__pokemonMongoDbPromise || null;

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

  if (cachedDbPromise) {
    return cachedDbPromise;
  }

  if (!cachedClientPromise) {
    cachedClient = new MongoClient(MONGO_URL, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      socketTimeoutMS: 20000,
      maxPoolSize: 5,
      minPoolSize: 0,
      retryReads: true,
      retryWrites: true,
    });

    cachedClientPromise = cachedClient.connect();
    globalThis.__pokemonMongoClient = cachedClient;
    globalThis.__pokemonMongoClientPromise = cachedClientPromise;
  }

  cachedDbPromise = cachedClientPromise.then(async (connectedClient) => {
    const db = connectedClient.db(DB_NAME);
    await db.command({ ping: 1 });
    return db;
  }).catch((error) => {
    cachedClient = null;
    cachedClientPromise = null;
    cachedDbPromise = null;
    globalThis.__pokemonMongoClient = null;
    globalThis.__pokemonMongoClientPromise = null;
    globalThis.__pokemonMongoDbPromise = null;
    throw error;
  });

  globalThis.__pokemonMongoDbPromise = cachedDbPromise;
  return cachedDbPromise;
}
