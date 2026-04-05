require('dotenv').config();
const { MongoClient } = require('mongodb');

async function compareAccounts() {
  const client = new MongoClient(process.env.MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const users = await db.collection('users').find({}).toArray();
    
    console.log('📊 Total users in database:', users.length);
    console.log('\n🔍 Comparing account structures:\n');
    
    // Sort by creation date (oldest first)
    users.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateA - dateB;
    });
    
    users.forEach((user, index) => {
      const isOld = index < 3; // First 3 are likely old accounts
      console.log(`${isOld ? '❌ OLD' : '✅ NEW'} Account: ${user.username}`);
      console.log(`   Created: ${user.createdAt || 'Unknown (VERY OLD)'}`);
      console.log(`   Password hash: ${user.password}`);
      console.log(`   Password length: ${user.password?.length || 0}`);
      console.log(`   Has ID: ${!!user.id}`);
      console.log(`   Has _id: ${!!user._id}`);
      
      // Test password verification
      const testPassword = user.username.toLowerCase(); // Assume password is same as username
      const expectedHash = Buffer.from(testPassword).toString('base64');
      console.log(`   Expected hash for "${testPassword}": ${expectedHash}`);
      console.log(`   Match: ${expectedHash === user.password ? '✅' : '❌'}`);
      console.log('');
    });
    
  } finally {
    await client.close();
  }
}

compareAccounts().catch(console.error);
