require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkSpheal() {
  const client = new MongoClient(process.env.MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const sphealUser = await db.collection('users').findOne({ 
      username: { $regex: /^spheal$/i } 
    });
    
    if (sphealUser) {
      console.log('✅ Spheal account found!');
      console.log('Username in DB:', sphealUser.username);
      console.log('Password hash:', sphealUser.password);
      console.log('User ID:', sphealUser.id);
      console.log('Points:', sphealUser.points);
      
      // Test password hashing
      const testPassword = 'spheal';
      const expectedHash = Buffer.from(testPassword).toString('base64');
      console.log('\nPassword test:');
      console.log('Expected hash for "spheal":', expectedHash);
      console.log('Actual hash in DB:', sphealUser.password);
      console.log('Match:', expectedHash === sphealUser.password ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ Spheal account NOT found!');
      console.log('\nSearching for all users...');
      const allUsers = await db.collection('users').find({}).toArray();
      console.log('Total users:', allUsers.length);
      allUsers.forEach(u => console.log(`- ${u.username} (ID: ${u.id})`));
    }
    
  } finally {
    await client.close();
  }
}

checkSpheal().catch(console.error);
