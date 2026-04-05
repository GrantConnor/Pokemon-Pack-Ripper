require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDB() {
  console.log('Current MONGO_URL:', process.env.MONGO_URL.replace(/:[^:]*@/, ':****@'));
  
  const client = new MongoClient(process.env.MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const users = await db.collection('users').find({}).toArray();
    console.log('\n📊 Users in current database:');
    console.log('Total users:', users.length);
    
    if (users.length > 0) {
      console.log('\nUsernames:');
      users.forEach(u => console.log(`- ${u.username} (created: ${u.createdAt || 'unknown'})`));
    } else {
      console.log('⚠️  Database is EMPTY - no users found');
    }
    
    // Check for Spheal specifically
    const spheal = users.find(u => u.username.toLowerCase() === 'spheal');
    if (spheal) {
      console.log('\n✅ Spheal account EXISTS in current database');
    } else {
      console.log('\n❌ Spheal account NOT FOUND in current database');
    }
    
  } finally {
    await client.close();
  }
}

checkDB().catch(console.error);
