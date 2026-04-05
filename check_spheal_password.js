require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkSpheal() {
  const client = new MongoClient(process.env.MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Find Spheal account (case insensitive)
    const spheal = await db.collection('users').findOne({ 
      username: { $regex: /^spheal$/i } 
    });
    
    if (spheal) {
      console.log('✅ Spheal account found!');
      console.log('Username:', spheal.username);
      console.log('Password hash:', spheal.password);
      
      // Test common passwords
      const testPasswords = ['spheal', 'Spheal', 'password', 'admin'];
      
      console.log('\nTesting passwords:');
      testPasswords.forEach(pw => {
        const hash = Buffer.from(pw).toString('base64');
        const match = hash === spheal.password;
        console.log(`  "${pw}" → ${hash} ${match ? '✅ MATCH!' : '❌'}`);
      });
      
    } else {
      console.log('❌ Spheal account NOT found in database');
      console.log('\nAll usernames in database:');
      const users = await db.collection('users').find({}).toArray();
      users.forEach(u => console.log(`  - ${u.username}`));
    }
    
  } finally {
    await client.close();
  }
}

checkSpheal().catch(console.error);
