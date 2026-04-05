require('dotenv').config();
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

async function createSpheal() {
  const client = new MongoClient(process.env.MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const password = 'spheal';
    const hashedPassword = Buffer.from(password).toString('base64');
    
    const sphealUser = {
      id: uuidv4(),
      username: 'Spheal',
      password: hashedPassword,
      points: 999999,
      collection: [],
      pokemon: [],
      friends: [],
      tradeRequests: [],
      setAchievements: {},
      createdAt: new Date().toISOString(),
      lastPointsRefresh: new Date().toISOString()
    };
    
    await db.collection('users').insertOne(sphealUser);
    
    console.log('✅ Spheal admin account created!');
    console.log('Username: Spheal');
    console.log('Password: spheal');
    console.log('Points: 999999 (unlimited)');
    
  } finally {
    await client.close();
  }
}

createSpheal().catch(console.error);
