import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const STARTING_POINTS = 1000;
const PACK_COST = 100;
const BULK_PACK_COUNT = 10;
const BULK_PACK_COST = 1000;
const POINTS_REGEN_RATE = 100; // Points per regeneration
const POINTS_REGEN_INTERVAL = 21600000; // 6 hours in milliseconds (6 * 60 * 60 * 1000)

// Achievement milestones (per set)
const ACHIEVEMENTS = {
  TEN_CARDS: { threshold: 10, reward: 50, name: '10 Unique Cards' },
  THIRTY_CARDS: { threshold: 30, reward: 125, name: '30 Unique Cards' },
  FIFTY_CARDS: { threshold: 50, reward: 250, name: '50 Unique Cards' },
  SEVENTY_FIVE_CARDS: { threshold: 75, reward: 500, name: '75 Unique Cards' },
  HUNDRED_CARDS: { threshold: 100, reward: 750, name: '100 Unique Cards' },
  COMPLETE_SET: { threshold: 'complete', reward: 1500, name: 'Complete Set' }
};

let client;
let db;

async function connectDB() {
  if (db) return db;
  
  client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  return db;
}

// Helper function to hash password (simple for MVP)
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hashedPassword) {
  return hashPassword(password) === hashedPassword;
}

// Calculate regenerated points based on time elapsed
function calculateRegeneratedPoints(user) {
  if (user.username === 'Spheal') {
    return 999999; // Unlimited points for owner
  }
  
  const now = new Date().getTime();
  const lastRefresh = new Date(user.lastPointsRefresh || user.createdAt).getTime();
  const timeElapsed = now - lastRefresh;``
  const hoursElapsed = timeElapsed / POINTS_REGEN_INTERVAL;
  const pointsToAdd = Math.floor(hoursElapsed * POINTS_REGEN_RATE);
  
  return Math.min(user.points + pointsToAdd, 10000); // Cap at 10000 points
}

// Calculate time until next point regeneration
function calculateNextPointsTime(user) {
  if (user.username === 'Spheal') {
    return 0; // No waiting for owner
  }
  
  const now = new Date().getTime();
  const lastRefresh = new Date(user.lastPointsRefresh || user.createdAt).getTime();
  const timeElapsed = now - lastRefresh;
  const timeSinceLastPoint = timeElapsed % POINTS_REGEN_INTERVAL;
  const timeUntilNext = POINTS_REGEN_INTERVAL - timeSinceLastPoint;
  
  return Math.ceil(timeUntilNext / 1000); // Return seconds until next point
}

// Check and award achievements for a specific set (single-fire guaranteed)
async function checkAchievements(user, database, setId, setName, totalCardsInSet) {
  // Get unique cards for this specific set
  const cardsFromSet = user.collection.filter(card => card.set?.id === setId);
  const uniqueCards = new Set(cardsFromSet.map(card => card.id));
  const uniqueCount = uniqueCards.size;
  
  // Initialize setAchievements as object if it doesn't exist
  const earnedAchievements = user.setAchievements || {};
  const setAchievements = earnedAchievements[setId] || [];
  const newAchievements = [];
  let bonusPoints = 0;
  
  // Track which achievement keys to add
  const achievementKeysToAdd = [];
  
  // Check each achievement milestone for this set
  Object.entries(ACHIEVEMENTS).forEach(([key, achievement]) => {
    const achievementId = `${setId}_${key}`;
    
    // CRITICAL: Check if already earned to prevent double-firing
    if (setAchievements.includes(key)) {
      return; // Skip if already earned
    }
    
    if (achievement.threshold === 'complete') {
      // Complete set achievement
      if (uniqueCount >= totalCardsInSet) {
        newAchievements.push({
          id: achievementId,
          key: key,
          setId: setId,
          setName: setName,
          name: achievement.name,
          reward: achievement.reward,
          threshold: totalCardsInSet,
          uniqueCount: uniqueCount,
          totalCards: totalCardsInSet
        });
        bonusPoints += achievement.reward;
        achievementKeysToAdd.push(key);
      }
    } else {
      // Milestone achievements (10, 30, 50, 75, 100 cards)
      if (uniqueCount >= achievement.threshold) {
        newAchievements.push({
          id: achievementId,
          key: key,
          setId: setId,
          setName: setName,
          name: achievement.name,
          reward: achievement.reward,
          threshold: achievement.threshold,
          uniqueCount: uniqueCount,
          totalCards: totalCardsInSet
        });
        bonusPoints += achievement.reward;
        achievementKeysToAdd.push(key);
      }
    }
  });
  
  // Update user ONLY if new achievements earned
  if (newAchievements.length > 0) {
    // Use $addToSet to prevent duplicate achievement keys (idempotent operation)
    const updateResult = await database.collection('users').updateOne(
      { id: user.id },
      { 
        $addToSet: {
          [`setAchievements.${setId}`]: { $each: achievementKeysToAdd }
        },
        $inc: { points: bonusPoints }
      }
    );
    
    // Log if update didn't modify anything (shouldn't happen with our checks)
    if (updateResult.modifiedCount === 0) {
      console.log(`Warning: Achievement update for ${setId} didn't modify document. May indicate race condition.`);
    }
  }
  
  return { newAchievements, bonusPoints, uniqueCount, totalCards: totalCardsInSet };
}

// TCG-accurate pack opening logic (10 cards total: 4 commons, 3 uncommons, 3 foil slots)
// NO DUPLICATES within a single pack
function openPack(cards) {
  // Filter out Energy cards
  const nonEnergyCards = cards.filter(c => c.supertype !== 'Energy');
  
  if (nonEnergyCards.length < 10) {
    // If set doesn't have enough cards, just return random 10
    const pulledCards = [];
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * nonEnergyCards.length);
      pulledCards.push(nonEnergyCards[randomIndex]);
    }
    return pulledCards;
  }
  
  // Categorize cards by rarity for TCG-accurate distribution
  const commons = nonEnergyCards.filter(c => c.rarity === 'Common');
  const uncommons = nonEnergyCards.filter(c => c.rarity === 'Uncommon');
  
  // Rare and special cards (for guaranteed rare slot and foil slots)
  const rares = nonEnergyCards.filter(c => c.rarity === 'Rare' || c.rarity === 'Rare Holo');
  const doubleRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Double Rare') || c.rarity.toLowerCase().includes(' ex')));
  const illustrationRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Illustration Rare') && !c.rarity.includes('Special'));
  const ultraRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Ultra Rare') || c.rarity.includes('Rare Ultra')));
  const rainbowRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Rare Rainbow'));
  const specialIllustrationRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Special Illustration Rare'));
  const hyperRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Hyper Rare'));
  const secretRares = nonEnergyCards.filter(c => c.rarity && (c.rarity.includes('Rare Secret') || c.rarity.includes('Secret Rare')));

  const pulledCards = [];
  const pulledCardIds = new Set(); // Track pulled card IDs to prevent duplicates

  // Helper function to get a unique card
  const getUniqueCard = (pool) => {
    const availableCards = pool.filter(card => !pulledCardIds.has(card.id));
    if (availableCards.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];
    pulledCardIds.add(card.id);
    return card;
  };

  // Helper to select rare-or-better with NEW SYSTEM:
  // Step 1: Always get a regular rare
  // Step 2: 10% chance (1 in 10 packs) to upgrade to special table
  // Step 3: If upgrade triggers, roll on special rare table
  const selectRareOrBetter = () => {
    // Step 1: Get a regular rare by default
    let selectedCard = rares.length > 0 ? getUniqueCard(rares) : getUniqueCard(nonEnergyCards);
    
    // Step 2: 10% chance to upgrade to something better
    const upgradeRoll = Math.random() * 100;
    
    if (upgradeRoll < 10) {
      // Step 3: You got the upgrade! Now roll on the special table
      const specialRoll = Math.random() * 100;
      
      // Special table percentages (out of the 10% that get upgrades):
      // Hyper Rare: 5% of upgrades (0.5% overall)
      if (specialRoll < 5 && hyperRares.length > 0) {
        const card = getUniqueCard(hyperRares);
        if (card) return card;
      }
      // Secret Rare: 5% of upgrades (0.5% overall) - SAME AS HYPER RARE
      else if (specialRoll < 10 && secretRares.length > 0) {
        const card = getUniqueCard(secretRares);
        if (card) return card;
      }
      // Special Illustration Rare: 10% of upgrades (1% overall)
      else if (specialRoll < 20 && specialIllustrationRares.length > 0) {
        const card = getUniqueCard(specialIllustrationRares);
        if (card) return card;
      }
      // Ultra Rare: 20% of upgrades (2% overall)
      else if (specialRoll < 40 && ultraRares.length > 0) {
        const card = getUniqueCard(ultraRares);
        if (card) return card;
      }
      // Rainbow Rare: 20% of upgrades (2% overall) - SAME AS ULTRA RARE
      else if (specialRoll < 60 && rainbowRares.length > 0) {
        const card = getUniqueCard(rainbowRares);
        if (card) return card;
      }
      // Illustration Rare: 20% of upgrades (2% overall)
      else if (specialRoll < 80 && illustrationRares.length > 0) {
        const card = getUniqueCard(illustrationRares);
        if (card) return card;
      }
      // Double Rare: 20% of upgrades (2% overall)
      else if (specialRoll < 100 && doubleRares.length > 0) {
        const card = getUniqueCard(doubleRares);
        if (card) return card;
      }
    }
    
    // If no upgrade triggered or no special cards available, return the regular rare
    return selectedCard;
  };

  // 1. Pull 4 commons (40%)
  for (let i = 0; i < 4; i++) {
    if (commons.length > 0) {
      const card = getUniqueCard(commons);
      if (card) {
        pulledCards.push(card);
      } else {
        // Fallback to any card if all commons are used
        const card = getUniqueCard(nonEnergyCards);
        if (card) pulledCards.push(card);
      }
    } else {
      // Fallback to any card
      const card = getUniqueCard(nonEnergyCards);
      if (card) pulledCards.push(card);
    }
  }

  // 2. Pull 3 uncommons (30%)
  for (let i = 0; i < 3; i++) {
    if (uncommons.length > 0) {
      const card = getUniqueCard(uncommons);
      if (card) {
        pulledCards.push(card);
      } else {
        const card = getUniqueCard(nonEnergyCards);
        if (card) pulledCards.push(card);
      }
    } else {
      const card = getUniqueCard(nonEnergyCards);
      if (card) pulledCards.push(card);
    }
  }

  // 3. Pull 1 guaranteed rare-or-better (with realistic TCG weighted odds)
  const guaranteedRare = selectRareOrBetter();
  if (guaranteedRare) {
    pulledCards.push(guaranteedRare);
  } else {
    const card = getUniqueCard(nonEnergyCards);
    if (card) pulledCards.push(card);
  }

  // 4. Pull 2 reverse holo slots (ONLY commons/uncommons - NEVER rares)
  // This ensures only ONE rare per pack total
  for (let i = 0; i < 2; i++) {
    // Reverse holo can only be common or uncommon (NOT rare)
    const reversePool = [...commons, ...uncommons];
    const reverseCard = getUniqueCard(reversePool);
    if (reverseCard) {
      pulledCards.push({ ...reverseCard, isReverseHolo: true });
    } else {
      // Fallback to any non-rare card
      const fallbackPool = nonEnergyCards.filter(c => !c.rarity?.includes('Rare'));
      const card = getUniqueCard(fallbackPool.length > 0 ? fallbackPool : nonEnergyCards);
      if (card) pulledCards.push({ ...card, isReverseHolo: true });
    }
  }

  // Ensure we always return exactly 10 cards
  while (pulledCards.length < 10) {
    const card = getUniqueCard(nonEnergyCards);
    if (card) {
      pulledCards.push(card);
    } else {
      // If we truly run out of unique cards (very rare), just add a random one
      const randomIndex = Math.floor(Math.random() * nonEnergyCards.length);
      pulledCards.push(nonEnergyCards[randomIndex]);
      break;
    }
  }

  return pulledCards.slice(0, 10); // Ensure exactly 10 cards
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);

  try {
    // Get all sets
    if (pathname.includes('/api/sets')) {
      const response = await axios.get(`${POKEMON_TCG_API}/sets`);
      // Filter out unwanted sets
      const filteredSets = response.data.data.filter(set => {
        const name = set.name.toLowerCase();
        const total = set.total || 0;
        
        // Remove McDonald's sets
        if (name.includes('mcdonald')) return false;
        
        // Remove Black Star Promos
        if (name.includes('promo') || name.includes('black star')) return false;
        
        // Remove Trainer Kits
        if (name.includes('trainer kit')) return false;
        
        // Remove Hidden Fates Shiny Vault (we'll merge it with Hidden Fates)
        if (name.includes('shiny vault')) return false;
        
        // Remove sets with less than 50 cards
        if (total < 50) return false;
        
        return true;
      });
      
      return NextResponse.json({ sets: filteredSets });
    }

    // Get cards from a specific set
    if (pathname.includes('/api/cards')) {
      const setId = searchParams.get('setId');
      if (!setId) {
        return NextResponse.json({ error: 'Set ID required' }, { status: 400 });
      }
      
      let allCards = [];
      
      // If Hidden Fates, merge with Shiny Vault
      if (setId === 'sm115') {
        // Fetch Hidden Fates cards
        const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`);
        allCards = [...hiddenFatesResponse.data.data];
        
        // Fetch Shiny Vault cards
        const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`);
        allCards = [...allCards, ...shinyVaultResponse.data.data];
      } else {
        const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`);
        allCards = response.data.data;
      }
      
      return NextResponse.json({ cards: allCards });
    }

    // Get user collection
    if (pathname.includes('/api/collection')) {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ collection: user.collection || [] });
    }

    // Get friends and pending requests
    if (pathname.includes('/api/friends')) {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Get friend details
      const friendIds = user.friends || [];
      const friends = await database.collection('users')
        .find({ id: { $in: friendIds } })
        .project({ id: 1, username: 1, tradesCompleted: 1 })
        .toArray();

      // Get pending request details
      const requestIds = user.friendRequests || [];
      const requests = await database.collection('users')
        .find({ id: { $in: requestIds } })
        .project({ id: 1, username: 1 })
        .toArray();

      // Get sent request details
      const sentIds = user.sentFriendRequests || [];
      const sentRequests = await database.collection('users')
        .find({ id: { $in: sentIds } })
        .project({ id: 1, username: 1 })
        .toArray();

      return NextResponse.json({ 
        friends,
        pendingRequests: requests,
        sentRequests,
        tradeRequests: user.tradeRequests || []
      });
    }

    // Admin: Get all users (Spheal only)
    if (pathname.includes('/api/admin/users')) {
      const adminId = searchParams.get('adminId');
      
      const database = await connectDB();
      
      if (adminId) {
        const admin = await database.collection('users').findOne({ id: adminId });
        if (!admin || admin.username !== 'Spheal') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }
      
      const users = await database.collection('users')
        .find({})
        .project({ id: 1, username: 1, points: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .toArray();

      return NextResponse.json({ users });
    }

    // Check session and update points
    if (pathname.includes('/api/session')) {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ authenticated: false });
      }

      const database = await connectDB();
      let user = await database.collection('users').findOne({ id: userId });
      
      if (!user) {
        return NextResponse.json({ authenticated: false });
      }

      // Calculate and update regenerated points
      const newPoints = calculateRegeneratedPoints(user);
      const nextPointsIn = calculateNextPointsTime(user);
      
      if (newPoints !== user.points) {
        await database.collection('users').updateOne(
          { id: userId },
          { 
            $set: { 
              points: newPoints,
              lastPointsRefresh: new Date().toISOString()
            } 
          }
        );
        user.points = newPoints;
      }

      return NextResponse.json({ 
        authenticated: true, 
        user: { 
          id: user.id, 
          username: user.username,
          points: user.points,
          nextPointsIn: nextPointsIn,
          setAchievements: user.setAchievements || {}
        } 
      });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);

  try {
    const body = await request.json();

    // Sign up
    if (pathname.includes('/api/auth/signup')) {
      const { username, password } = body;
      
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Check if user exists (case-insensitive)
      const existingUser = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      
      if (existingUser) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }

      // Create new user
      const newUser = {
        id: uuidv4(),
        username,
        password: hashPassword(password),
        collection: [],
        setAchievements: {},
        friends: [],
        friendRequests: [],
        sentFriendRequests: [],
        tradeRequests: [],
        tradesCompleted: 0,
        points: username === 'Spheal' ? 999999 : STARTING_POINTS,
        lastPointsRefresh: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await database.collection('users').insertOne(newUser);

      return NextResponse.json({ 
        success: true, 
        user: { 
          id: newUser.id, 
          username: newUser.username,
          points: newUser.points,
          nextPointsIn: calculateNextPointsTime(newUser),
          setAchievements: newUser.setAchievements || {}
        } 
      });
    }

    // Sign in
    if (pathname.includes('/api/auth/signin')) {
      const { username, password } = body;
      
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
      }

      const database = await connectDB();
      // Find user case-insensitively
      let user = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      
      if (!user || !verifyPassword(password, user.password)) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Calculate and update regenerated points
      const newPoints = calculateRegeneratedPoints(user);
      const nextPointsIn = calculateNextPointsTime(user);
      
      if (newPoints !== user.points) {
        await database.collection('users').updateOne(
          { id: user.id },
          { 
            $set: { 
              points: newPoints,
              lastPointsRefresh: new Date().toISOString()
            } 
          }
        );
        user.points = newPoints;
      }

      return NextResponse.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username,
          points: user.points,
          nextPointsIn: nextPointsIn,
          setAchievements: user.setAchievements || {}
        } 
      });
    }

    // Open pack (single or bulk)
    if (pathname.includes('/api/packs/open')) {
      const { userId, setId, bulk } = body;
      
      if (!userId || !setId) {
        return NextResponse.json({ error: 'User ID and Set ID required' }, { status: 400 });
      }

      const database = await connectDB();
      let user = await database.collection('users').findOne({ id: userId });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const packCount = bulk ? BULK_PACK_COUNT : 1;
      const totalCost = bulk ? BULK_PACK_COST : PACK_COST;

      // Check if user has enough points (except Spheal)
      if (user.username !== 'Spheal' && user.points < totalCost) {
        return NextResponse.json({ 
          error: 'Insufficient points', 
          pointsNeeded: totalCost - user.points 
        }, { status: 402 });
      }

      // Fetch all cards from the set (with Hidden Fates merge)
      let allCards = [];
      
      if (setId === 'sm115') {
        // Merge Hidden Fates + Shiny Vault
        const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`);
        allCards = [...hiddenFatesResponse.data.data];
        
        const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`);
        allCards = [...allCards, ...shinyVaultResponse.data.data];
      } else {
        const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`);
        allCards = response.data.data;
      }

      if (allCards.length === 0) {
        return NextResponse.json({ error: 'No cards found for this set' }, { status: 404 });
      }

      // Open packs
      let allPulledCards = [];
      let individualPacks = []; // Track each pack separately for bulk openings
      
      for (let i = 0; i < packCount; i++) {
        const pulledCards = openPack(allCards);
        allPulledCards = [...allPulledCards, ...pulledCards];
        
        if (bulk) {
          // Store each pack separately with pack number
          individualPacks.push({
            packNumber: i + 1,
            cards: pulledCards
          });
        }
      }

      // Deduct points and save to user's collection
      const newPoints = user.username === 'Spheal' ? 999999 : user.points - totalCost;
      
      // Add pulledAt timestamp to cards for both response and database
      const cardsWithTimestamp = allPulledCards.map((card, index) => ({
        ...card,
        pulledAt: new Date().toISOString(),
        packNumber: bulk ? Math.floor(index / 10) + 1 : 1 // Assign pack number
      }));
      
      // Prepare individual packs with timestamps for response
      const packsWithTimestamps = bulk ? individualPacks.map(pack => ({
        packNumber: pack.packNumber,
        cards: pack.cards.map(card => ({
          ...card,
          pulledAt: new Date().toISOString(),
          packNumber: pack.packNumber
        }))
      })) : null;
      
      await database.collection('users').updateOne(
        { id: userId },
        { 
          $push: { 
            collection: { 
              $each: cardsWithTimestamp
            } 
          },
          $set: { points: newPoints }
        }
      );

      // Refresh user data and check achievements for this specific set
      user = await database.collection('users').findOne({ id: userId });
      
      // Get set name from first card (they all have set info)
      const setName = allPulledCards[0]?.set?.name || 'Unknown Set';
      const totalCardsInSet = allCards.filter(c => c.supertype !== 'Energy').length;
      
      const achievementResult = await checkAchievements(user, database, setId, setName, totalCardsInSet);

      // Refresh user one more time if achievements were earned
      if (achievementResult.newAchievements.length > 0) {
        user = await database.collection('users').findOne({ id: userId });
      }

      return NextResponse.json({ 
        success: true, 
        cards: cardsWithTimestamp,
        packs: packsWithTimestamps, // Include individual packs for bulk openings
        isBulk: bulk,
        pointsRemaining: user.points,
        achievements: achievementResult.newAchievements.length > 0 ? achievementResult : null
      });
    }

    // Admin: Send points to user (Spheal only)
    if (pathname.includes('/api/admin/send-points')) {
      const { adminId, targetUsername, points } = body;
      
      if (!adminId || !targetUsername || !points) {
        return NextResponse.json({ error: 'Admin ID, target username, and points required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Verify admin is Spheal
      const admin = await database.collection('users').findOne({ id: adminId });
      if (!admin || admin.username !== 'Spheal') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }

      // Find target user
      const targetUser = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } 
      });

      if (!targetUser) {
        return NextResponse.json({ error: `User '${targetUsername}' not found` }, { status: 404 });
      }

      // Add points to target user
      await database.collection('users').updateOne(
        { id: targetUser.id },
        { $inc: { points: points } }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Successfully sent ${points} points to ${targetUser.username}`,
        newBalance: targetUser.points + points
      });
    }

    // Admin: Remove user's collection (Spheal only)
    if (pathname.includes('/api/admin/remove-collection')) {
      const { adminId, targetUsername } = body;
      
      if (!adminId || !targetUsername) {
        return NextResponse.json({ error: 'Admin ID and target username required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Verify admin is Spheal
      const admin = await database.collection('users').findOne({ id: adminId });
      if (!admin || admin.username !== 'Spheal') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }

      // Find target user
      const targetUser = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } 
      });

      if (!targetUser) {
        return NextResponse.json({ error: `User '${targetUsername}' not found` }, { status: 404 });
      }

      // Remove entire collection and reset achievements
      await database.collection('users').updateOne(
        { id: targetUser.id },
        { 
          $set: { 
            collection: [],
            setAchievements: {}
          } 
        }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Successfully removed collection for ${targetUser.username}`
      });
    }

    // Friends: Send friend request
    if (pathname.includes('/api/friends/send-request')) {
      const { userId, targetUsername } = body;
      
      if (!userId || !targetUsername) {
        return NextResponse.json({ error: 'User ID and target username required' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });
      const targetUser = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } 
      });

      if (!user || !targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (user.id === targetUser.id) {
        return NextResponse.json({ error: 'Cannot add yourself as friend' }, { status: 400 });
      }

      // Check if already friends
      if (user.friends?.includes(targetUser.id)) {
        return NextResponse.json({ error: 'Already friends' }, { status: 400 });
      }

      // Check if request already sent
      if (targetUser.friendRequests?.includes(user.id)) {
        return NextResponse.json({ error: 'Friend request already sent' }, { status: 400 });
      }

      // Add friend request
      await database.collection('users').updateOne(
        { id: targetUser.id },
        { $addToSet: { friendRequests: user.id } }
      );

      await database.collection('users').updateOne(
        { id: user.id },
        { $addToSet: { sentFriendRequests: targetUser.id } }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Friend request sent to ${targetUser.username}` 
      });
    }

    // Friends: Accept friend request
    if (pathname.includes('/api/friends/accept')) {
      const { userId, friendId } = body;
      
      if (!userId || !friendId) {
        return NextResponse.json({ error: 'User ID and friend ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Add to both users' friend lists
      await database.collection('users').updateOne(
        { id: userId },
        { 
          $addToSet: { friends: friendId },
          $pull: { friendRequests: friendId }
        }
      );

      await database.collection('users').updateOne(
        { id: friendId },
        { 
          $addToSet: { friends: userId },
          $pull: { sentFriendRequests: userId }
        }
      );

      return NextResponse.json({ success: true });
    }

    // Friends: Decline friend request
    if (pathname.includes('/api/friends/decline')) {
      const { userId, friendId } = body;
      
      if (!userId || !friendId) {
        return NextResponse.json({ error: 'User ID and friend ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { friendRequests: friendId } }
      );

      await database.collection('users').updateOne(
        { id: friendId },
        { $pull: { sentFriendRequests: userId } }
      );

      return NextResponse.json({ success: true });
    }

    // Trades: Send trade request
    if (pathname.includes('/api/trades/send')) {
      const { userId, friendId, offeredCards, requestedCards } = body;
      
      if (!userId || !friendId || !offeredCards || !requestedCards) {
        return NextResponse.json({ error: 'Invalid trade request' }, { status: 400 });
      }

      if (!Array.isArray(offeredCards) || !Array.isArray(requestedCards)) {
        return NextResponse.json({ error: 'Cards must be arrays' }, { status: 400 });
      }

      if (offeredCards.length === 0 || offeredCards.length > 10) {
        return NextResponse.json({ error: 'Must offer 1-10 cards' }, { status: 400 });
      }

      // Allow 0 requested cards (free gift) but max 10
      if (requestedCards.length > 10) {
        return NextResponse.json({ error: 'Cannot request more than 10 cards' }, { status: 400 });
      }

      // Prevent taking cards for free - if requesting cards, must offer cards
      if (requestedCards.length > 0 && offeredCards.length === 0) {
        return NextResponse.json({ error: 'Cannot take cards without offering anything' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });
      const friend = await database.collection('users').findOne({ id: friendId });

      if (!user || !friend) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if users are friends
      if (!user.friends?.includes(friendId)) {
        return NextResponse.json({ error: 'Can only trade with friends' }, { status: 403 });
      }

      const tradeRequest = {
        id: uuidv4(),
        from: userId,
        fromUsername: user.username,
        to: friendId,
        toUsername: friend.username,
        offeredCards: offeredCards,
        requestedCards: requestedCards,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await database.collection('users').updateOne(
        { id: friendId },
        { $push: { tradeRequests: tradeRequest } }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Trade request sent to ${friend.username}` 
      });
    }

    // Trades: Accept trade
    if (pathname.includes('/api/trades/accept')) {
      const { userId, tradeId } = body;
      
      if (!userId || !tradeId) {
        return NextResponse.json({ error: 'Invalid trade acceptance' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Find the trade request
      const trade = user.tradeRequests?.find(t => t.id === tradeId);
      if (!trade) {
        return NextResponse.json({ error: 'Trade request not found' }, { status: 404 });
      }

      const fromUser = await database.collection('users').findOne({ id: trade.from });
      if (!fromUser) {
        return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
      }

      // Execute the trade in separate operations to avoid MongoDB conflicts
      
      // Step 1: Remove offered cards from sender
      await database.collection('users').updateOne(
        { id: trade.from },
        { $pull: { collection: { $or: trade.offeredCards.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } } }
      );

      // Step 2: Add requested cards to sender (if any)
      if (trade.requestedCards.length > 0) {
        await database.collection('users').updateOne(
          { id: trade.from },
          { $push: { collection: { $each: trade.requestedCards } } }
        );
      }

      // Step 3: Remove requested cards from receiver (if any)
      if (trade.requestedCards.length > 0) {
        await database.collection('users').updateOne(
          { id: userId },
          { $pull: { collection: { $or: trade.requestedCards.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } } }
        );
      }

      // Step 4: Add offered cards to receiver
      await database.collection('users').updateOne(
        { id: userId },
        { $push: { collection: { $each: trade.offeredCards } } }
      );

      // Step 5: Remove the trade request
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { tradeRequests: { id: tradeId } } }
      );

      // Step 6: Increment trade counter for both users
      await database.collection('users').updateOne(
        { id: trade.from },
        { $inc: { tradesCompleted: 1 } }
      );

      await database.collection('users').updateOne(
        { id: userId },
        { $inc: { tradesCompleted: 1 } }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Trade completed with ${trade.fromUsername}` 
      });
    }

    // Trades: Decline trade
    if (pathname.includes('/api/trades/decline')) {
      const { userId, tradeId } = body;
      
      if (!userId || !tradeId) {
        return NextResponse.json({ error: 'User ID and trade ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { tradeRequests: { id: tradeId } } }
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url);

  try {
    // Sign out
    if (pathname.includes('/api/auth/signout')) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}