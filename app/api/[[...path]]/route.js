import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB as sharedConnectDB } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const STARTING_POINTS = 1000;
const PACK_COST = 100; // Default cost
const BULK_PACK_COUNT = 10;
const POINTS_REGEN_RATE = 1000; // Points per regeneration
const POINTS_REGEN_INTERVAL = 7200000; // 2 hours in milliseconds (2 * 60 * 60 * 1000)

const EXTERNAL_API_TIMEOUT = 15000;
const SETS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CARDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const externalApiCache = globalThis.__pokemonExternalApiCache || {
  sets: null,
  setsFetchedAt: 0,
  cardsBySet: {},
};

globalThis.__pokemonExternalApiCache = externalApiCache;

// Set-specific pricing
const SET_PRICING = {
  // Vintage sets (Base - Sky Ridge): 200 for 1, 2000 for 10
  'base1': { single: 200, bulk: 2000 },
  'base2': { single: 200, bulk: 2000 },
  'basep': { single: 200, bulk: 2000 }, // Base Set
  'jungle': { single: 200, bulk: 2000 },
  'fossil': { single: 200, bulk: 2000 },
  'base3': { single: 200, bulk: 2000 }, // Base Set 2
  'gym1': { single: 200, bulk: 2000 }, // Gym Heroes
  'gym2': { single: 200, bulk: 2000 }, // Gym Challenge
  'neo1': { single: 200, bulk: 2000 }, // Neo Genesis
  'neo2': { single: 200, bulk: 2000 }, // Neo Discovery
  'neo3': { single: 200, bulk: 2000 }, // Neo Revelation
  'neo4': { single: 200, bulk: 2000 }, // Neo Destiny
  'base4': { single: 200, bulk: 2000 }, // Legendary Collection
  'ecard1': { single: 200, bulk: 2000 }, // Expedition
  'ecard2': { single: 200, bulk: 2000 }, // Aquapolis
  'ecard3': { single: 200, bulk: 2000 }, // Sky Ridge
  
  // EX era sets: 150 for 1, 1500 for 10
  'ex1': { single: 150, bulk: 1500 }, // EX Ruby & Sapphire
  'ex2': { single: 150, bulk: 1500 }, // EX Sandstorm
  'ex3': { single: 150, bulk: 1500 }, // EX Dragon
  'ex4': { single: 150, bulk: 1500 }, // EX Team Magma vs Team Aqua
  'ex5': { single: 150, bulk: 1500 }, // EX Hidden Legends
  'ex6': { single: 150, bulk: 1500 }, // EX FireRed & LeafGreen
  'ex7': { single: 150, bulk: 1500 }, // EX Team Rocket Returns
  'ex8': { single: 150, bulk: 1500 }, // EX Deoxys
  'ex9': { single: 150, bulk: 1500 }, // EX Emerald
  'ex10': { single: 150, bulk: 1500 }, // EX Unseen Forces
  'ex11': { single: 150, bulk: 1500 }, // EX Delta Species
  'ex12': { single: 150, bulk: 1500 }, // EX Legend Maker
};

// Vintage sets (2000-point tier) - these have 15% rare drop rate
const VINTAGE_SETS = [
  'base1', 'base2', 'basep', 'jungle', 'fossil', 'base3',
  'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4',
  'base4', 'ecard1', 'ecard2', 'ecard3'
];

// Function to get pack cost for a set
function getPackCost(setId, bulk = false) {
  const pricing = SET_PRICING[setId];
  if (pricing) {
    return bulk ? pricing.bulk : pricing.single;
  }
  // Default pricing for modern sets
  return bulk ? (PACK_COST * 10) : PACK_COST;
}

// Pokemon Wilds constants
const MAX_POKEMON_ID = 1010; // Gen 1-9 (up to Paldea)
const MIN_SPAWN_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_CATCH_ATTEMPTS = 3;

// XP and Leveling constants
const XP_FROM_PACK_OPEN = 2; // XP all Pokemon get when opening a pack
const XP_FROM_CATCH = 10; // XP all Pokemon get when catching a Pokemon
const XP_PER_PURCHASE = 50; // XP gained per purchase
const POINTS_PER_XP_PURCHASE = 50; // Points cost per XP purchase
const MAX_LEVEL = 100;
const EVOLUTION_ITEM_COST = 500;
const EVOLUTION_ITEM_NAMES = [
  'fire-stone','water-stone','thunder-stone','leaf-stone','moon-stone','sun-stone',
  'dawn-stone','dusk-stone','shiny-stone','ice-stone','oval-stone','kings-rock',
  'metal-coat','dragon-scale','upgrade','dubious-disc','protector','electirizer',
  'magmarizer','razor-claw','razor-fang','reaper-cloth','sachet','whipped-dream',
  'sweet-apple','tart-apple','cracked-pot','chipped-pot','galarica-cuff','galarica-wreath',
  'black-augurite','peat-block','auspicious-armor','malicious-armor','syrupy-apple','snowball'
];

// XP calculation with linear scaling: Level 1→2 needs 10 XP, Level 99→100 needs 1800 XP
function getXPToNextLevel(currentLevel) {
  if (currentLevel >= MAX_LEVEL) return 0;
  return Math.floor(10 + (currentLevel - 1) * 18);
}

function getTotalXPForLevel(level) {
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += getXPToNextLevel(i);
  }
  return totalXP;
}

function calculateLevelFromXP(xp) {
  let level = 1;
  let cumulativeXP = 0;
  
  while (level < MAX_LEVEL) {
    const xpNeeded = getXPToNextLevel(level);
    if (cumulativeXP + xpNeeded > xp) break;
    cumulativeXP += xpNeeded;
    level++;
  }
  
  return level;
}

// Achievement milestones (per set)
const ACHIEVEMENTS = {
  TEN_CARDS: { threshold: 10, reward: 50, name: '10 Unique Cards' },
  THIRTY_CARDS: { threshold: 30, reward: 125, name: '30 Unique Cards' },
  FIFTY_CARDS: { threshold: 50, reward: 250, name: '50 Unique Cards' },
  SEVENTY_FIVE_CARDS: { threshold: 75, reward: 500, name: '75 Unique Cards' },
  HUNDRED_CARDS: { threshold: 100, reward: 750, name: '100 Unique Cards' },
  COMPLETE_SET: { threshold: 'complete', reward: 1500, name: 'Complete Set' }
};

// Card breakdown values (points awarded for breaking down cards)
const BREAKDOWN_VALUES = {
  'Common': 5,
  'Uncommon': 10,
  'Rare': 20,
  'Rare Holo': 20,
  'Double Rare': 50,
  'Illustration Rare': 250,
  'Ultra Rare': 250,
  'Rare Ultra': 250,
  'Rare Rainbow': 250,
  'Special Illustration Rare': 250,
  'Hyper Rare': 1000,
  'Rare Secret': 1000,
  'Secret Rare': 1000
};

async function connectDB() {
  return sharedConnectDB();
}

// Helper function to normalize usernames consistently
function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to hash password (simple for MVP)
function hashPassword(password) {
  return Buffer.from(String(password)).toString('base64');
}

function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string') {
    return { valid: false, strategy: 'invalid-stored-password-type' };
  }

  const rawPassword = String(password ?? '');
  const trimmedPassword = rawPassword.trim();
  const hashedRawPassword = hashPassword(rawPassword);
  const hashedTrimmedPassword = hashPassword(trimmedPassword);

  if (storedPassword === hashedTrimmedPassword) {
    return { valid: true, strategy: 'base64-trimmed' };
  }

  if (storedPassword === hashedRawPassword) {
    return { valid: true, strategy: 'base64-raw' };
  }

  // Legacy fallback: some manually-seeded accounts may still have plaintext passwords.
  if (storedPassword === trimmedPassword) {
    return { valid: true, strategy: 'plaintext-trimmed' };
  }

  if (storedPassword === rawPassword) {
    return { valid: true, strategy: 'plaintext-raw' };
  }

  return { valid: false, strategy: 'no-match' };
}

function logAuth(event, details = {}) {
  const timestamp = new Date().toISOString();
  try {
    console.log(`[AUTH][${timestamp}] ${event}`, JSON.stringify(details));
  } catch {
    console.log(`[AUTH][${timestamp}] ${event}`, details);
  }
}

// Calculate regenerated points based on time elapsed
function calculateRegeneratedPoints(user) {
  if (user.username === 'Spheal') {
    return 999999; // Unlimited points for owner
  }
  
  const now = new Date().getTime();
  const lastRefresh = new Date(user.lastPointsRefresh || user.createdAt).getTime();
  const timeElapsed = now - lastRefresh;
  const hoursElapsed = timeElapsed / POINTS_REGEN_INTERVAL;
  const pointsToAdd = Math.floor(hoursElapsed * POINTS_REGEN_RATE);
  
  return user.points + pointsToAdd;
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
// Vintage sets (2000-point tier) have 15% rare drop rate
function openPack(cards, setId = null) {
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
  const shinyRares = nonEnergyCards.filter(c => c.rarity && c.rarity.includes('Shiny Rare'));
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

  // Helper to select rare-or-better with BUFFED SYSTEM:
  // Step 1: Always get a regular rare
  // Step 2: 10% chance to upgrade to special table
  // Step 3: If upgrade triggers, roll on special rare table
  const selectRareOrBetter = () => {
    // Step 1: Get a regular rare by default
    let selectedCard = rares.length > 0 ? getUniqueCard(rares) : getUniqueCard(nonEnergyCards);
    
    // Step 2: 10% chance to upgrade to something better
    const upgradeRoll = Math.random() * 100;
    
    if (upgradeRoll < 10) {
      // Step 3: You got the upgrade! Now roll on the special table
      const specialRoll = Math.random() * 100;
      
      // Special table percentages (out of the upgrade table):
      // Hyper Rare: 2.5% of upgrades
      if (specialRoll < 2.5 && hyperRares.length > 0) {
        const card = getUniqueCard(hyperRares);
        if (card) return card;
      }
      // Secret Rare: 2.5% of upgrades
      else if (specialRoll < 5 && secretRares.length > 0) {
        const card = getUniqueCard(secretRares);
        if (card) return card;
      }
      // Rainbow Rare: 5% of upgrades
      else if (specialRoll < 10 && rainbowRares.length > 0) {
        const card = getUniqueCard(rainbowRares);
        if (card) return card;
      }
      // Ultra Rare: 15% of upgrades
      else if (specialRoll < 25 && ultraRares.length > 0) {
        const card = getUniqueCard(ultraRares);
        if (card) return card;
      }
      // Illustration Rare / Special Illustration Rare: 15% of upgrades
      else if (specialRoll < 40 && (illustrationRares.length > 0 || specialIllustrationRares.length > 0)) {
        const illustrationPool = [...illustrationRares, ...specialIllustrationRares];
        const card = getUniqueCard(illustrationPool);
        if (card) return card;
      }
      // Shiny Rare: 15% of upgrades
      else if (specialRoll < 55 && shinyRares.length > 0) {
        const card = getUniqueCard(shinyRares);
        if (card) return card;
      }
      // Double Rare / Rare Holo EX: 45% of upgrades
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
  // SPECIAL: Vintage sets (2000-point tier) only have 15% chance of getting a Rare
  let guaranteedRare;
  
  if (setId && VINTAGE_SETS.includes(setId)) {
    // Vintage set: 15% chance for Rare, 85% chance for Uncommon
    const rareRoll = Math.random() * 100;
    console.log(`[VINTAGE SET: ${setId}] Rare roll: ${rareRoll.toFixed(2)}% ${rareRoll <= 15 ? '✨ RARE!' : '⚪ Uncommon'}`);
    
    if (rareRoll <= 15) {
      // Lucky! You get a rare
      guaranteedRare = selectRareOrBetter();
    } else {
      // 85% of the time: get an uncommon instead
      guaranteedRare = uncommons.length > 0 ? getUniqueCard(uncommons) : getUniqueCard(nonEnergyCards);
    }
  } else {
    // Modern/EX sets: Normal rare drop rate (100% guaranteed)
    guaranteedRare = selectRareOrBetter();
  }
  
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

// ===== POKEMON WILDS HELPER FUNCTIONS =====


function buildPokemonSprite(pokemon, pokemonId, isShiny = false) {
  const officialArtwork = pokemon?.sprites?.other?.['official-artwork'];
  const homeArtwork = pokemon?.sprites?.other?.home;

  if (isShiny) {
    return (
      officialArtwork?.front_shiny ||
      homeArtwork?.front_shiny ||
      pokemon?.sprites?.front_shiny ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokemonId}.png` ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonId}.png`
    );
  }

  return (
    officialArtwork?.front_default ||
    homeArtwork?.front_default ||
    pokemon?.sprites?.front_default ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png` ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
  );
}

function normalizeStoredSprite(pokemonData) {
  if (!pokemonData?.id) return pokemonData;
  if (pokemonData.isShiny && (!pokemonData.sprite || !String(pokemonData.sprite).includes('/shiny/'))) {
    return {
      ...pokemonData,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokemonData.id}.png`
    };
  }
  if (!pokemonData.isShiny && !pokemonData.sprite) {
    return {
      ...pokemonData,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonData.id}.png`
    };
  }
  return pokemonData;
}

// Fetch Pokemon data from PokéAPI

async function resolvePokemonIdFromQuery(query) {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const numericId = Number(raw);
    return numericId >= 1 && numericId <= MAX_POKEMON_ID ? numericId : null;
  }
  try {
    const response = await axios.get(`${POKEAPI_BASE}/pokemon/${encodeURIComponent(raw)}`);
    return response.data?.id || null;
  } catch {
    return null;
  }
}

async function fetchPokemonData(pokemonId, forceShiny = false) {
  try {
    // Fetch basic Pokemon data
    const pokemonResponse = await axios.get(`${POKEAPI_BASE}/pokemon/${pokemonId}`);
    const pokemon = pokemonResponse.data;
    
    // Fetch species data for rarity info
    const speciesResponse = await axios.get(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`);
    const species = speciesResponse.data;
    
    // Determine if shiny (forced OR 1/4000 chance)
    const isShiny = forceShiny || (Math.random() < (1 / 4000));
    
    // Extract data
    const types = pokemon.types.map(t => t.type.name);
    
    // Get sprite from PokéAPI artwork fields, with safe fallbacks
    const sprite = buildPokemonSprite(pokemon, pokemonId, isShiny);
    if (isShiny) {
      console.log(`✨ SHINY ${forceShiny ? '(FORCED)' : '(NATURAL)'}: ${pokemon.name} #${pokemonId}`);
      console.log(`   Sprite: ${sprite}`);
    }
    
    // Get all learnable moves with their data
    const movePromises = pokemon.moves
      .filter(m => {
        const details = m.version_group_details;
        return details.some(d => d.move_learn_method.name === 'level-up' || d.move_learn_method.name === 'machine');
      })
      .slice(0, 50) // Limit to prevent too many API calls
      .map(async m => {
        try {
          const moveData = await axios.get(m.move.url);
          return {
            name: m.move.name,
            power: moveData.data.power,
            accuracy: moveData.data.accuracy,
            pp: moveData.data.pp,
            type: moveData.data.type.name,
            damageClass: moveData.data.damage_class.name,
            effectChance: moveData.data.effect_chance,
            effectEntries: moveData.data.effect_entries.find(e => e.language.name === 'en')?.short_effect || '',
            ailment: moveData.data.meta?.ailment?.name || null,
            ailmentChance: moveData.data.meta?.ailment_chance || 0,
            statChanges: moveData.data.stat_changes.map(sc => ({
              stat: sc.stat.name,
              change: sc.change
            }))
          };
        } catch (err) {
          return { name: m.move.name, power: null, accuracy: null, type: 'normal', damageClass: 'status' };
        }
      });
    
    const allMovesData = await Promise.all(movePromises);
    const allMoveNames = allMovesData.map(m => m.name);
    
    // Generate random IVs (0-31 for each stat)
    const ivs = {
      hp: Math.floor(Math.random() * 32),
      attack: Math.floor(Math.random() * 32),
      defense: Math.floor(Math.random() * 32),
      spAttack: Math.floor(Math.random() * 32),
      spDefense: Math.floor(Math.random() * 32),
      speed: Math.floor(Math.random() * 32)
    };
    
    // Select 4 random moves for starting moveset
    const shuffledMoves = allMovesData.sort(() => 0.5 - Math.random());
    const moveset = shuffledMoves.slice(0, Math.min(4, allMovesData.length)).map(m => m.name);
    
    // Generate gender based on gender_rate
    let gender = null;
    if (species.gender_rate === -1) {
      gender = 'genderless';
    } else if (species.gender_rate === 0) {
      gender = 'male';
    } else if (species.gender_rate === 8) {
      gender = 'female';
    } else {
      const femaleChance = species.gender_rate / 8;
      gender = Math.random() < femaleChance ? 'female' : 'male';
    }
    
    return {
      id: pokemon.id,
      name: pokemon.name,
      displayName: species.names.find(n => n.language.name === 'en')?.name || pokemon.name,
      types: types,
      sprite: sprite,
      isShiny: isShiny,
      captureRate: species.capture_rate,
      isLegendary: species.is_legendary,
      isMythical: species.is_mythical,
      gender: gender,
      ivs: ivs,
      moveset: moveset,
      allMoves: allMoveNames,
      allMovesData: allMovesData, // Full move data with damage/effects
      nickname: null,
      baseStats: {
        hp: pokemon.stats[0].base_stat,
        attack: pokemon.stats[1].base_stat,
        defense: pokemon.stats[2].base_stat,
        spAttack: pokemon.stats[3].base_stat,
        spDefense: pokemon.stats[4].base_stat,
        speed: pokemon.stats[5].base_stat
      }
    };
  } catch (error) {
    console.error(`Error fetching Pokemon ${pokemonId}:`, error.message);
    throw error;
  }
}

// Calculate catch chance based on Pokemon rarity
function calculateCatchChance(captureRate, isLegendary, isMythical) {
  // New simplified catch rates:
  // Legendary/Mythical: 50%
  // All others: 100%
  
  if (isLegendary || isMythical) {
    return 50; // 50% catch rate for legendary/mythical
  }
  
  return 100; // 100% catch rate for normal Pokemon
}

const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2, steel: 0.5, ice: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

function getTypeMultiplier(moveType, defenderTypes = []) {
  return defenderTypes.reduce((multiplier, type) => {
    const typeRules = TYPE_CHART[moveType] || {};
    return multiplier * (typeRules[type] ?? 1);
  }, 1);
}

function formatMoveName(moveName = '') {
  return moveName.replace(/-/g, ' ');
}

function calculateDamage(attacker, defender, move) {
  if (!move.power || move.damageClass === 'status') {
    return { damage: 0, multiplier: 1, stab: 1, isCritical: false };
  }

  const level = attacker.level || 50;
  const power = move.power;
  const isPhysical = move.damageClass === 'physical';
  const attackStat = Math.max(1, isPhysical ? attacker.stats.attack : attacker.stats.spAttack);
  const defenseStat = Math.max(1, isPhysical ? defender.stats.defense : defender.stats.spDefense);
  const typeMultiplier = getTypeMultiplier(move.type, defender.types || []);
  const stab = (attacker.types || []).includes(move.type) ? 1.5 : 1;
  const critical = Math.random() < 0.0625 ? 1.5 : 1;
  const randomFactor = 0.85 + Math.random() * 0.15;
  const baseDamage = ((2 * level / 5 + 2) * power * attackStat / defenseStat / 50 + 2);
  const damage = typeMultiplier === 0
    ? 0
    : Math.max(1, Math.floor(baseDamage * stab * typeMultiplier * critical * randomFactor));

  return {
    damage,
    multiplier: typeMultiplier,
    stab,
    isCritical: critical > 1
  };
}

// Initialize or update global spawn
async function updateGlobalSpawn(database) {
  const globalSpawn = await database.collection('global_spawn').findOne({ id: 'current' });
  const now = Date.now();
  
  // Check if we need a new spawn
  // Only spawn if: no spawn exists, OR spawn was caught and timer expired
  if (!globalSpawn || (globalSpawn.caughtBy && globalSpawn.nextSpawnTime && now >= globalSpawn.nextSpawnTime)) {
    // Generate new spawn with rarity-based spawning
    let randomId;
    let pokemonData;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      randomId = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
      pokemonData = await fetchPokemonData(randomId);
      attempts++;
      
      // 10% chance to allow legendary/mythical, otherwise reroll
      if (pokemonData.isLegendary || pokemonData.isMythical) {
        const allowRare = Math.random() < 0.10; // 10% chance
        if (!allowRare && attempts < maxAttempts) {
          continue; // Reroll
        }
      }
      break; // Accept this Pokemon
    } while (attempts < maxAttempts);
    
    // Add random level (5-50)
    pokemonData.level = Math.floor(Math.random() * 46) + 5;
    
    // Calculate actual stats using Pokemon formula
    pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);
    
    const newSpawn = {
      id: 'current',
      pokemon: pokemonData,
      spawnedAt: now,
      nextSpawnTime: null, // Will be set after caught
      caughtBy: null,
      catchAttempts: {} // Track attempts per user: { userId: attemptCount }
    };
    
    await database.collection('global_spawn').updateOne(
      { id: 'current' },
      { $set: newSpawn },
      { upsert: true }
    );
    
    console.log(`New Pokemon spawned: ${pokemonData.displayName} (Shiny: ${pokemonData.isShiny})`);
    return newSpawn;
  }
  
  // Return existing active spawn
  return globalSpawn;
}

// Calculate actual stats using Pokemon formula (simplified Level 50 standard)
function calculateStats(baseStats, ivs, level) {
  // HP Formula: floor(((2 * Base + IV) * Level) / 100) + Level + 10
  const hp = Math.floor(((2 * baseStats.hp + ivs.hp) * level) / 100) + level + 10;
  
  // Other stats: floor(((2 * Base + IV) * Level) / 100) + 5
  const attack = Math.floor(((2 * baseStats.attack + ivs.attack) * level) / 100) + 5;
  const defense = Math.floor(((2 * baseStats.defense + ivs.defense) * level) / 100) + 5;
  const spAttack = Math.floor(((2 * baseStats.spAttack + ivs.spAttack) * level) / 100) + 5;
  const spDefense = Math.floor(((2 * baseStats.spDefense + ivs.spDefense) * level) / 100) + 5;
  const speed = Math.floor(((2 * baseStats.speed + ivs.speed) * level) / 100) + 5;
  
  return {
    hp,
    attack,
    defense,
    spAttack,
    spDefense,
    speed
  };
}

// Apply XP to all owned Pokemon and handle level-ups
async function applyXPToAllPokemon(userId, xpAmount, database) {
  const allPokemon = await database.collection('caught_pokemon').find({ userId }).toArray();
  
  for (const pokemon of allPokemon) {
    const currentXP = (pokemon.currentXP || 0) + xpAmount;
    const currentLevel = pokemon.level || 1;
    
    // Calculate new level based on total XP
    let newLevel = currentLevel;
    let remainingXP = currentXP;
    
    // Check if we can level up
    while (newLevel < MAX_LEVEL) {
      const xpNeeded = getXPToNextLevel(newLevel);
      if (remainingXP >= xpNeeded) {
        remainingXP -= xpNeeded;
        newLevel++;
      } else {
        break;
      }
    }
    
    // If at max level, set XP to 0
    if (newLevel >= MAX_LEVEL) {
      remainingXP = 0;
    }
    
    // Update Pokemon
    const updateData = {
      currentXP: remainingXP,
      level: newLevel
    };
    
    // Recalculate stats if level changed
    if (newLevel !== currentLevel) {
      updateData.stats = calculateStats(pokemon.baseStats, pokemon.ivs, newLevel);
    }
    
    await database.collection('caught_pokemon').updateOne(
      { _id: pokemon._id },
      { $set: updateData }
    );
  }
}


const evolutionItemCache = globalThis.__wildsEvolutionItemCache || { items: null, fetchedAt: 0 };
globalThis.__wildsEvolutionItemCache = evolutionItemCache;



const HARD_CODED_ITEM_FALLBACKS = {
  'upgrade': '/items/upgrade.png',
  'sweet-apple': '/items/sweet-apple.png',
  'tart-apple': '/items/tart-apple.png',
  'cracked-pot': '/items/cracked-pot.png',
  'chipped-pot': '/items/chipped-pot.png',
  'galarica-cuff': '/items/galarica-cuff.png',
  'galarica-wreath': '/items/galarica-wreath.png',
  'black-augurite': '/items/black-augurite.png',
  'peat-block': '/items/peat-block.png',
  'auspicious-armor': '/items/auspicious-armor.png',
  'malicious-armor': '/items/malicious-armor.png',
  'syrupy-apple': '/items/syrupy-apple.png',
};

function getEvolutionItemSpriteUrl(itemName, apiSprite = null) {
  return apiSprite || HARD_CODED_ITEM_FALLBACKS[itemName] || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName}.png`;
}

function formatEvolutionItemName(name) {
  return String(name || '').split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

async function getEvolutionItemsCatalog() {
  if (evolutionItemCache.items && (Date.now() - evolutionItemCache.fetchedAt) < 24 * 60 * 60 * 1000) {
    return evolutionItemCache.items;
  }

  const items = [];
  for (const itemName of EVOLUTION_ITEM_NAMES) {
    try {
      const response = await axios.get(`${POKEAPI_BASE}/item/${itemName}`);
      items.push({
        itemName,
        name: formatEvolutionItemName(itemName),
        sprite: getEvolutionItemSpriteUrl(itemName, response.data?.sprites?.default || null),
        cost: EVOLUTION_ITEM_COST,
      });
    } catch (error) {
      items.push({
        itemName,
        name: formatEvolutionItemName(itemName),
        sprite: getEvolutionItemSpriteUrl(itemName, null),
        cost: EVOLUTION_ITEM_COST,
      });
    }
  }

  evolutionItemCache.items = items;
  evolutionItemCache.fetchedAt = Date.now();
  return items;
}

function extractEvolutionRequirement(evolutionDetails = {}) {
  return {
    minLevel: evolutionDetails.min_level || null,
    trigger: evolutionDetails.trigger?.name || null,
    itemName: evolutionDetails.item?.name || evolutionDetails.held_item?.name || null,
    requiresTrade: evolutionDetails.trigger?.name === 'trade',
  };
}

async function applyEvolutionToStoredPokemon(database, pokemon, evolutionData) {
  const evolvedData = await fetchPokemonData(evolutionData.evolvesTo, pokemon.isShiny);
  const updateData = {
    id: evolvedData.id,
    name: evolvedData.name,
    displayName: evolvedData.displayName,
    sprite: evolvedData.sprite,
    types: evolvedData.types,
    baseStats: evolvedData.baseStats,
    allMoves: evolvedData.allMoves,
    allMovesData: evolvedData.allMovesData,
    captureRate: evolvedData.captureRate,
    isLegendary: evolvedData.isLegendary,
    isMythical: evolvedData.isMythical,
    stats: calculateStats(evolvedData.baseStats, pokemon.ivs, pokemon.level),
    moveset: evolvedData.moveset,
  };

  await database.collection('caught_pokemon').updateOne(
    { _id: pokemon._id },
    { $set: updateData }
  );

  return evolvedData;
}

async function autoEvolveTradePokemon(database, pokemon) {
  const evolutionData = await fetchEvolutionChain(pokemon.id);
  if (!evolutionData?.canEvolve) return null;
  if (evolutionData.trigger !== 'trade') return null;
  if (evolutionData.itemName) return null;
  return applyEvolutionToStoredPokemon(database, pokemon, evolutionData);
}

// Fetch evolution chain data from PokeAPI

function getSpecialEvolutionData(pokemon, itemName = null) {
  if (!pokemon || Number(pokemon.id) !== 133) return null;

  if (itemName === 'fire-stone') {
    return { canEvolve: true, evolvesTo: 136, trigger: 'use-item', itemName: 'fire-stone' };
  }
  if (itemName === 'water-stone') {
    return { canEvolve: true, evolvesTo: 134, trigger: 'use-item', itemName: 'water-stone' };
  }
  if (itemName === 'thunder-stone') {
    return { canEvolve: true, evolvesTo: 135, trigger: 'use-item', itemName: 'thunder-stone' };
  }
  if (itemName === 'leaf-stone') {
    return { canEvolve: true, evolvesTo: 470, trigger: 'use-item', itemName: 'leaf-stone' };
  }
  if (itemName === 'snowball') {
    return { canEvolve: true, evolvesTo: 471, trigger: 'use-item', itemName: 'snowball' };
  }
  if (itemName) return null;

  const level = Number(pokemon.level || 1);
  const gender = String(pokemon.gender || '').toLowerCase();
  if (gender === 'female' && level >= 50) {
    return { canEvolve: true, evolvesTo: 700, trigger: 'level-up', minLevel: 50 };
  }
  if (gender === 'female') {
    return { canEvolve: true, evolvesTo: 196, trigger: 'level-up', minLevel: null };
  }
  if (gender === 'male') {
    return { canEvolve: true, evolvesTo: 197, trigger: 'level-up', minLevel: null };
  }
  return { canEvolve: true, evolvesTo: 196, trigger: 'level-up', minLevel: null };
}

async function fetchEvolutionChain(pokemonId) {
  try {
    const speciesResponse = await axios.get(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`);
    const evolutionChainUrl = speciesResponse.data.evolution_chain.url;
    
    const chainResponse = await axios.get(evolutionChainUrl);
    const chain = chainResponse.data.chain;
    
    // Parse the evolution chain to find the current Pokemon and its evolution
    function findEvolution(node, currentId) {
      if (node.species.url.includes(`/${currentId}/`)) {
        // Found current Pokemon, check if it can evolve
        if (node.evolves_to && node.evolves_to.length > 0) {
          const nextEvolution = node.evolves_to[0];
          const evolutionDetails = nextEvolution.evolution_details[0];
          
          // Extract Pokemon ID from URL
          const urlParts = nextEvolution.species.url.split('/');
          const nextId = parseInt(urlParts[urlParts.length - 2]);
          
          const requirement = extractEvolutionRequirement(evolutionDetails);
          return {
            canEvolve: true,
            evolvesTo: nextId,
            ...requirement,
          };
        }
        return { canEvolve: false };
      }
      
      // Recursively search in evolutions
      for (const evolution of node.evolves_to || []) {
        const result = findEvolution(evolution, currentId);
        if (result) return result;
      }
      
      return null;
    }
    
    return findEvolution(chain, pokemonId) || { canEvolve: false };
  } catch (error) {
    console.error(`Error fetching evolution chain for ${pokemonId}:`, error.message);
    return { canEvolve: false };
  }
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);
  
  console.log(`GET request to: ${pathname}`);

  try {
    // Get all sets
    if (pathname.includes('/api/sets')) {
      console.log('Sets endpoint hit');
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
        
        // Remove Crown Zenith Galarian Gallery (we'll merge it with Crown Zenith)
        if (set.id === 'swsh12pt5gg' || name.includes('galarian gallery')) return false;
        
        // Remove sets with less than 50 cards
        if (total < 50) return false;
        
        return true;
      });
      
      // Add pricing information to each set
      const setsWithPricing = filteredSets.map(set => ({
        ...set,
        packPrice: getPackCost(set.id, false),
        bulkPrice: getPackCost(set.id, true)
      }));

      externalApiCache.sets = setsWithPricing;
      externalApiCache.setsFetchedAt = Date.now();
      
      return NextResponse.json({ sets: setsWithPricing, cached: false });
    }

    // Get cards from a specific set
    if (pathname.includes('/api/cards')) {
      const setId = searchParams.get('setId');
      if (!setId) {
        return NextResponse.json({ error: 'Set ID required' }, { status: 400 });
      }

      const cachedCards = externalApiCache.cardsBySet[setId];
      if (cachedCards && (Date.now() - cachedCards.fetchedAt) < CARDS_CACHE_TTL_MS) {
        return NextResponse.json({ cards: cachedCards.cards, cached: true });
      }
      
      let allCards = [];
      
      // If Hidden Fates, merge with Shiny Vault
      if (setId === 'sm115') {
        // Fetch Hidden Fates cards
        const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...hiddenFatesResponse.data.data];
        
        // Fetch Shiny Vault cards
        const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...allCards, ...shinyVaultResponse.data.data];
      } else {
        const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = response.data.data;
      }

      externalApiCache.cardsBySet[setId] = {
        cards: allCards,
        fetchedAt: Date.now(),
      };
      
      return NextResponse.json({ cards: allCards, cached: false });
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
      const onlineThreshold = Date.now() - 60 * 1000;
      const friends = await database.collection('users')
        .find({ id: { $in: friendIds } })
        .project({ id: 1, username: 1, tradesCompleted: 1, lastSeenAt: 1 })
        .toArray();
      const friendsWithPresence = friends.map(friend => ({
        ...friend,
        isOnline: !!friend.lastSeenAt && new Date(friend.lastSeenAt).getTime() >= onlineThreshold,
      }));

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
        friends: friendsWithPresence,
        pendingRequests: requests,
        sentRequests,
        tradeRequests: user.tradeRequests || [],
        battleRequests: user.battleRequests || [],
        activeBattleId: user.activeBattleId || null
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
          setAchievements: user.setAchievements || {},
          tradesCompleted: user.tradesCompleted || 0
        } 
      });
    }

    // Get current Pokemon spawn
    if (pathname.includes('/api/wilds/current')) {
      const database = await connectDB();
      const spawn = await updateGlobalSpawn(database);
      
      // Don't send if already caught
      if (spawn.caughtBy) {
        return NextResponse.json({ 
          spawn: null,
          nextSpawnTime: spawn.nextSpawnTime
        });
      }
      
      const normalizedSpawn = spawn?.pokemon ? { ...spawn, pokemon: normalizeStoredSprite(spawn.pokemon) } : spawn;
      return NextResponse.json({ spawn: normalizedSpawn });
    }

    // Get user's caught Pokemon
    if (pathname.includes('/api/wilds/my-pokemon')) {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const caughtPokemon = await database.collection('caught_pokemon')
        .find({ userId })
        .sort({ caughtAt: -1 })
        .toArray();

      // Fix Pokemon without level/stats (backwards compatibility)
      const fixedPokemon = caughtPokemon.map(pokemon => {
        if (!pokemon.level || !pokemon.stats) {
          // Add default level if missing
          const level = pokemon.level || 50;
          
          // Calculate stats if missing
          const stats = pokemon.stats || calculateStats(
            pokemon.baseStats || {hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100},
            pokemon.ivs,
            level
          );
          
          return { ...pokemon, level, stats, currentXP: pokemon.currentXP || 0 };
        }
        
        // Add currentXP if missing
        if (pokemon.currentXP === undefined) {
          return { ...pokemon, currentXP: 0 };
        }
        
        return pokemon;
      });

      return NextResponse.json({ pokemon: fixedPokemon });
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
  const authTraceId = uuidv4();

  logAuth('signup.request.received', {
    authTraceId,
    pathname,
    usernamePresent: typeof username === 'string' && username.length > 0,
    usernameLength: typeof username === 'string' ? username.length : 0,
    passwordLength: typeof password === 'string' ? password.length : 0,
    contentType: request.headers.get('content-type') || null,
    host: request.headers.get('host') || null,
    userAgent: request.headers.get('user-agent') || null,
  });

  if (!username || !password) {
    logAuth('signup.request.invalid', { authTraceId, reason: 'missing-username-or-password' });
    return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
  }

  const trimmedUsername = String(username).trim();
  const normalizedUsername = normalizeUsername(trimmedUsername);
  const trimmedPassword = String(password).trim();

  logAuth('signup.request.normalized', {
    authTraceId,
    trimmedUsername,
    normalizedUsername,
    trimmedUsernameLength: trimmedUsername.length,
    trimmedPasswordLength: trimmedPassword.length,
  });

  if (!trimmedUsername || !trimmedPassword) {
    logAuth('signup.request.invalid', { authTraceId, reason: 'blank-after-trim', normalizedUsername });
    return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
  }

  const database = await connectDB();
  logAuth('signup.db.connected', { authTraceId, dbName: process.env.DB_NAME || null });

  const existingUser = await database.collection('users').findOne({ normalizedUsername });

  if (existingUser) {
    logAuth('signup.duplicate.normalized', {
      authTraceId,
      normalizedUsername,
      existingUserId: existingUser.id || String(existingUser._id),
      existingUsername: existingUser.username || null,
    });
    return NextResponse.json({ error: 'Username already exists', authTraceId }, { status: 409 });
  }

  const legacyMatch = await database.collection('users').findOne({
    username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') }
  });

  logAuth('signup.legacy.lookup.complete', {
    authTraceId,
    normalizedUsername,
    foundLegacyMatch: !!legacyMatch,
  });

  if (legacyMatch) {
    logAuth('signup.duplicate.legacy', {
      authTraceId,
      normalizedUsername,
      existingUserId: legacyMatch.id || String(legacyMatch._id),
      existingUsername: legacyMatch.username || null,
    });
    return NextResponse.json({ error: 'Username already exists', authTraceId }, { status: 409 });
  }

  const newUser = {
    id: uuidv4(),
    username: trimmedUsername,
    normalizedUsername,
    password: hashPassword(trimmedPassword),
    collection: [],
    setAchievements: {},
    friends: [],
    friendRequests: [],
    sentFriendRequests: [],
    tradeRequests: [],
    tradesCompleted: 0,
    points: trimmedUsername === 'Spheal' ? 999999 : STARTING_POINTS,
    lastPointsRefresh: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  const insertResult = await database.collection('users').insertOne(newUser);
  logAuth('signup.insert.success', {
    authTraceId,
    insertedId: String(insertResult.insertedId),
    newUserId: newUser.id,
    normalizedUsername,
  });

  return NextResponse.json({
    success: true,
    authTraceId,
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
  const authTraceId = uuidv4();

  logAuth('signin.request.received', {
    authTraceId,
    pathname,
    usernamePresent: typeof username === 'string' && username.length > 0,
    usernameLength: typeof username === 'string' ? username.length : 0,
    passwordLength: typeof password === 'string' ? password.length : 0,
    contentType: request.headers.get('content-type') || null,
    host: request.headers.get('host') || null,
    userAgent: request.headers.get('user-agent') || null,
  });

  if (!username || !password) {
    logAuth('signin.request.invalid', { authTraceId, reason: 'missing-username-or-password' });
    return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
  }

  const rawUsername = String(username);
  const trimmedUsername = rawUsername.trim();
  const normalizedUsername = normalizeUsername(trimmedUsername);
  const rawPassword = String(password);
  const trimmedPassword = rawPassword.trim();

  logAuth('signin.request.normalized', {
    authTraceId,
    rawUsernameLength: rawUsername.length,
    trimmedUsername,
    normalizedUsername,
    rawPasswordLength: rawPassword.length,
    trimmedPasswordLength: trimmedPassword.length,
  });

  if (!trimmedUsername || !trimmedPassword) {
    logAuth('signin.request.invalid', { authTraceId, reason: 'blank-after-trim', normalizedUsername });
    return NextResponse.json({ error: 'Username and password required', authTraceId }, { status: 400 });
  }

  const database = await connectDB();
  logAuth('signin.db.connected', { authTraceId, dbName: process.env.DB_NAME || null });

  let user = await database.collection('users').findOne({ normalizedUsername });
  let lookupStrategy = 'normalizedUsername';

  if (!user) {
    lookupStrategy = 'legacy-username-query';
    user = await database.collection('users').findOne({
      username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') }
    });

    logAuth('signin.legacy.lookup.complete', {
      authTraceId,
      normalizedUsername,
      foundLegacyMatch: !!user,
    });

    if (user && !user.normalizedUsername) {
      await database.collection('users').updateOne(
        { _id: user._id },
        { $set: { normalizedUsername: normalizeUsername(user.username) } }
      );
      user.normalizedUsername = normalizeUsername(user.username);
      logAuth('signin.legacy.backfill.normalized-username', {
        authTraceId,
        userId: user.id || String(user._id),
        normalizedUsername: user.normalizedUsername,
      });
    }
  }

  if (!user) {
    logAuth('signin.user.not-found', { authTraceId, normalizedUsername, lookupStrategy });
    return NextResponse.json({ error: 'Invalid credentials', authTraceId }, { status: 401 });
  }

  logAuth('signin.user.found', {
    authTraceId,
    userId: user.id || String(user._id),
    username: user.username || null,
    normalizedUsername: user.normalizedUsername || null,
    lookupStrategy,
    storedPasswordType: typeof user.password,
    storedPasswordLength: typeof user.password === 'string' ? user.password.length : null,
  });

  const passwordCheck = verifyPassword(rawPassword, user.password);
  if (!passwordCheck.valid) {
    logAuth('signin.password.mismatch', {
      authTraceId,
      userId: user.id || String(user._id),
      username: user.username || null,
      normalizedUsername,
      strategyTried: passwordCheck.strategy,
    });
    return NextResponse.json({ error: 'Invalid credentials', authTraceId }, { status: 401 });
  }

  logAuth('signin.password.match', {
    authTraceId,
    userId: user.id || String(user._id),
    strategy: passwordCheck.strategy,
  });

  if (passwordCheck.strategy.startsWith('plaintext')) {
    const migratedPassword = hashPassword(trimmedPassword);
    await database.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: migratedPassword } }
    );
    user.password = migratedPassword;
    logAuth('signin.password.migrated-to-base64', {
      authTraceId,
      userId: user.id || String(user._id),
      fromStrategy: passwordCheck.strategy,
    });
  }

  const resolvedUserId = user.id || String(user._id);

  if (!user.id) {
    await database.collection('users').updateOne(
      { _id: user._id },
      { $set: { id: resolvedUserId } }
    );
    user.id = resolvedUserId;
    logAuth('signin.user.backfill.id', { authTraceId, resolvedUserId });
  }

  const previousPoints = user.points;
  const newPoints = calculateRegeneratedPoints(user);
  const nextPointsIn = calculateNextPointsTime(user);

  if (newPoints !== user.points) {
    await database.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          points: newPoints,
          lastPointsRefresh: new Date().toISOString()
        }
      }
    );
    user.points = newPoints;
    logAuth('signin.points.regenerated', {
      authTraceId,
      userId: resolvedUserId,
      previousPoints,
      newPoints,
      nextPointsIn,
    });
  }

  logAuth('signin.success', {
    authTraceId,
    userId: resolvedUserId,
    username: user.username || null,
    normalizedUsername,
    points: user.points,
    nextPointsIn,
  });

  return NextResponse.json({
    success: true,
    authTraceId,
    user: {
      id: resolvedUserId,
      username: user.username,
      points: user.points,
      nextPointsIn: nextPointsIn,
      setAchievements: user.setAchievements || {},
      tradesCompleted: user.tradesCompleted || 0
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
      const totalCost = getPackCost(setId, bulk);

      // Check if user has enough points (except Spheal)
      if (user.username !== 'Spheal' && user.points < totalCost) {
        return NextResponse.json({ 
          error: 'Insufficient points', 
          pointsNeeded: totalCost - user.points 
        }, { status: 402 });
      }

      // Fetch all cards from the set (with cache + merges for Hidden Fates and Crown Zenith)
      let allCards = [];
      const cachedCards = externalApiCache.cardsBySet[setId];

      if (cachedCards && (Date.now() - cachedCards.fetchedAt) < CARDS_CACHE_TTL_MS) {
        allCards = cachedCards.cards;
      } else if (setId === 'sm115') {
        // Merge Hidden Fates + Shiny Vault
        const hiddenFatesResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sm115&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...hiddenFatesResponse.data.data];

        const shinyVaultResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:sma&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...allCards, ...shinyVaultResponse.data.data];
      } else if (setId === 'swsh12pt5') {
        // Merge Crown Zenith + Crown Zenith Galarian Gallery
        const crownZenithResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...crownZenithResponse.data.data];

        const galarianGalleryResponse = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:swsh12pt5gg&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = [...allCards, ...galarianGalleryResponse.data.data];
      } else {
        const response = await axios.get(`${POKEMON_TCG_API}/cards?q=set.id:${setId}&pageSize=250`, {
          timeout: EXTERNAL_API_TIMEOUT,
        });
        allCards = response.data.data;
      }

      if (allCards.length > 0 && (!cachedCards || cachedCards.cards !== allCards)) {
        externalApiCache.cardsBySet[setId] = {
          cards: allCards,
          fetchedAt: Date.now(),
        };
      }

      if (allCards.length === 0) {
        return NextResponse.json({ error: 'No cards found for this set' }, { status: 404 });
      }

      // Open packs
      let allPulledCards = [];
      let individualPacks = []; // Track each pack separately for bulk openings
      
      for (let i = 0; i < packCount; i++) {
        const pulledCards = openPack(allCards, setId);
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

      let achievementResult = null;
      let pointsRemaining = newPoints;

      // Non-critical post-pack tasks should never block the reveal UI.
      try {
        await applyXPToAllPokemon(userId, XP_FROM_PACK_OPEN, database);
      } catch (xpError) {
        console.error('[PACK_OPEN] XP update failed but pack was already saved:', xpError?.message || xpError);
      }

      try {
        user = await database.collection('users').findOne({ id: userId });

        if (user) {
          // Get set name from first card (they all have set info)
          const setName = allPulledCards[0]?.set?.name || 'Unknown Set';
          const totalCardsInSet = allCards.filter(c => c.supertype !== 'Energy').length;
          const rawAchievementResult = await checkAchievements(user, database, setId, setName, totalCardsInSet);

          if (rawAchievementResult?.newAchievements?.length > 0) {
            achievementResult = rawAchievementResult;
            const refreshedUser = await database.collection('users').findOne({ id: userId });
            if (refreshedUser?.points !== undefined) {
              pointsRemaining = refreshedUser.points;
            }
          } else if (user.points !== undefined) {
            pointsRemaining = user.points;
          }
        }
      } catch (achievementError) {
        console.error('[PACK_OPEN] Achievement refresh failed but pack was already saved:', achievementError?.message || achievementError);
      }

      return NextResponse.json({ 
        success: true, 
        cards: cardsWithTimestamp,
        packs: packsWithTimestamps, // Include individual packs for bulk openings
        isBulk: bulk,
        pointsRemaining,
        achievements: achievementResult
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

    // Admin: Delete user completely (Spheal only)
    if (pathname.includes('/api/admin/delete-user')) {
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

      // Prevent deleting Spheal
      if (targetUsername.toLowerCase() === 'spheal') {
        return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 400 });
      }

      // Find target user
      const targetUser = await database.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${targetUsername}$`, 'i') } 
      });

      if (!targetUser) {
        return NextResponse.json({ error: `User '${targetUsername}' not found` }, { status: 404 });
      }

      // Delete user and all their data
      await database.collection('users').deleteOne({ id: targetUser.id });
      await database.collection('caught_pokemon').deleteMany({ userId: targetUser.id });

      return NextResponse.json({ 
        success: true, 
        message: `Successfully deleted user '${targetUser.username}' and all associated data`
      });
    }

    // Friends: Send friend request

    if (pathname.includes('/api/presence/ping')) {
      const { userId } = body;
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }
      const database = await connectDB();
      await database.collection('users').updateOne(
        { id: userId },
        { $set: { lastSeenAt: new Date().toISOString() } }
      );
      return NextResponse.json({ success: true });
    }

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

    // Accept Pokemon Trade (MUST be checked before general /api/friends/accept)
    if (pathname.includes('/api/friends/accept-pokemon-trade')) {
      const { userId, tradeId } = body;
      
      console.log('🔄 Accept Pokemon Trade Request:', { userId, tradeId });
      
      if (!userId || !tradeId) {
        console.log('❌ Missing userId or tradeId');
        return NextResponse.json({ error: 'User ID and Trade ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });

      if (!user) {
        console.log('❌ User not found:', userId);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      console.log('✓ User found:', user.username);
      console.log('📋 User trade requests:', user.tradeRequests);

      // Find the trade request
      const tradeRequest = user.tradeRequests?.find(t => t.id === tradeId);
      if (!tradeRequest) {
        console.log('❌ Trade request not found:', tradeId);
        console.log('Available trades:', user.tradeRequests?.map(t => t.id));
        return NextResponse.json({ error: 'Trade request not found' }, { status: 404 });
      }

      console.log('✓ Trade request found:', tradeRequest);

      // Get both Pokemon from the database
      const fromPokemonId = tradeRequest.offeredPokemon[0].pokemonId;
      const toPokemonId = tradeRequest.requestedPokemon[0].pokemonId;

      console.log('🔍 Looking for Pokemon:', { fromPokemonId, toPokemonId });

      const fromPokemon = await database.collection('caught_pokemon').findOne({
        _id: new ObjectId(fromPokemonId),
        userId: tradeRequest.fromId
      });

      const toPokemon = await database.collection('caught_pokemon').findOne({
        _id: new ObjectId(toPokemonId),
        userId: userId
      });

      if (!fromPokemon || !toPokemon) {
        console.log('❌ Pokemon not found:', { fromPokemon: !!fromPokemon, toPokemon: !!toPokemon });
        return NextResponse.json({ error: 'One or both Pokemon not found' }, { status: 404 });
      }

      console.log('✓ Both Pokemon found');

      // Execute the trade: swap ownership
      await database.collection('caught_pokemon').updateOne(
        { _id: fromPokemon._id },
        { $set: { userId: userId } }
      );

      await database.collection('caught_pokemon').updateOne(
        { _id: toPokemon._id },
        { $set: { userId: tradeRequest.fromId } }
      );

      console.log('✓ Pokemon ownership swapped');

      const autoEvolvedReceived = await autoEvolveTradePokemon(database, fromPokemon);
      const autoEvolvedSent = await autoEvolveTradePokemon(database, toPokemon);

      // Remove trade request
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { tradeRequests: { id: tradeId } } }
      );

      // Update trade counts for both users
      await database.collection('users').updateOne(
        { id: userId },
        { $inc: { tradesCompleted: 1 } }
      );

      await database.collection('users').updateOne(
        { id: tradeRequest.fromId },
        { $inc: { tradesCompleted: 1 } }
      );

      console.log('✅ Trade completed successfully!');

      return NextResponse.json({ 
        success: true,
        message: `Trade completed! You received ${autoEvolvedReceived?.displayName || fromPokemon.displayName}`,
        receivedPokemon: autoEvolvedReceived?.displayName || fromPokemon.displayName,
        sentPokemon: autoEvolvedSent?.displayName || toPokemon.displayName,
        autoEvolved: [autoEvolvedReceived?.displayName, autoEvolvedSent?.displayName].filter(Boolean)
      });
    }

    // Decline Pokemon Trade
    if (pathname.includes('/api/friends/decline-trade')) {
      const { userId, tradeId } = body;
      
      if (!userId || !tradeId) {
        return NextResponse.json({ error: 'User ID and Trade ID required' }, { status: 400 });
      }

      const database = await connectDB();

      // Remove trade request
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { tradeRequests: { id: tradeId } } }
      );

      return NextResponse.json({ success: true });
    }

    // Pokemon Trade: Send Pokemon trade request
    if (pathname.includes('/api/friends/trade')) {
      const { fromId, toId, offeredPokemon, requestedPokemon, type } = body;
      
      if (!fromId || !toId || !offeredPokemon || !requestedPokemon) {
        return NextResponse.json({ error: 'Invalid trade request' }, { status: 400 });
      }

      const database = await connectDB();
      const fromUser = await database.collection('users').findOne({ id: fromId });
      const toUser = await database.collection('users').findOne({ id: toId });

      if (!fromUser || !toUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const existingPokemonTrade = [...(toUser.tradeRequests || []), ...(fromUser.tradeRequests || [])].find((request) =>
        request.status === 'pending' && (
          (request.fromId === fromId && request.toId === toId) ||
          (request.fromId === toId && request.toId === fromId)
        )
      );

      if (existingPokemonTrade) {
        return NextResponse.json({ error: 'Only one pending Pokemon trade request is allowed between these users at a time' }, { status: 409 });
      }

      // Create trade request
      const tradeRequest = {
        id: uuidv4(),
        fromId,
        fromUsername: fromUser.username,
        toId,
        toUsername: toUser.username,
        offeredPokemon,
        requestedPokemon,
        type: type || 'pokemon-trade',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Add to recipient's trade requests
      await database.collection('users').updateOne(
        { id: toId },
        { $push: { tradeRequests: tradeRequest } }
      );

      return NextResponse.json({ 
        success: true, 
        message: `Trade request sent to ${toUser.username}`,
        trade: tradeRequest
      });
    }

    // Friends: Accept friend request (MUST be after Pokemon trade endpoints)
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

    // Friends: Decline friend request (MUST be after Pokemon trade endpoints)
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

      const existingCardTrade = [...(friend.tradeRequests || []), ...(user.tradeRequests || [])].find((trade) =>
        trade.status === 'pending' && 'offeredCards' in trade && (
          (trade.from === userId && trade.to === friendId) ||
          (trade.from === friendId && trade.to === userId)
        )
      );

      if (existingCardTrade) {
        return NextResponse.json({ error: 'Only one pending card trade request is allowed between these users at a time' }, { status: 409 });
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

    // TEST ENDPOINT
    if (pathname.includes('/api/test-single')) {
      return NextResponse.json({ message: 'Test single endpoint working' });
    }

    // Breakdown single card with quantity - NEW ENDPOINT NAME
    if (pathname.includes('/api/cards/breakdown-quantity')) {
      const { userId, cardId, amount } = body;
      
      // Validation
      if (!userId || !cardId) {
        return NextResponse.json({ error: 'User ID and Card ID required' }, { status: 400 });
      }
      
      if (amount === undefined || amount === null || isNaN(amount) || Number(amount) < 1) {
        return NextResponse.json({ error: 'Valid amount required (must be >= 1)' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Find all instances of this card for this user
      const userCards = user.collection || [];
      const matchingCards = userCards.filter(card => card.id === cardId);

      if (matchingCards.length < amount) {
        return NextResponse.json({ 
          error: `You only have ${matchingCards.length} of this card` 
        }, { status: 400 });
      }

      // Sort by pulledAt (oldest first) and take the amount to break down
      const cardsToBreakdown = matchingCards
        .sort((a, b) => new Date(a.pulledAt) - new Date(b.pulledAt))
        .slice(0, amount);

      // Calculate points
      const firstCard = cardsToBreakdown[0];
      const pointValue = BREAKDOWN_VALUES[firstCard.rarity] || 10;
      const totalPoints = pointValue * amount;

      // Remove the specific cards by their pulledAt timestamps
      await database.collection('users').updateOne(
        { id: userId },
        { 
          $pull: { 
            collection: { 
              $or: cardsToBreakdown.map(card => ({ id: card.id, pulledAt: card.pulledAt })) 
            } 
          },
          $inc: { points: totalPoints }
        }
      );

      return NextResponse.json({ 
        success: true, 
        pointsAwarded: totalPoints,
        cardsBreakdown: amount
      });
    }

    // Breakdown single card with quantity (check this BEFORE general breakdown)
    if (pathname.includes('/api/cards/breakdown-single')) {
      return NextResponse.json({ message: 'SINGLE BREAKDOWN ENDPOINT REACHED', body: body });
    }

    // Breakdown cards for points (batch breakdown)
    if (pathname.includes('/api/cards/breakdown') && !pathname.includes('/api/cards/breakdown-quantity') && !pathname.includes('/api/cards/breakdown-single')) {
      const { userId, cards } = body;
      
      if (!userId || !cards || !Array.isArray(cards) || cards.length === 0) {
        return NextResponse.json({ error: 'Invalid breakdown request' }, { status: 400 });
      }

      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Calculate total points from breakdown
      let totalPoints = 0;
      cards.forEach(card => {
        const pointValue = BREAKDOWN_VALUES[card.rarity] || 10;
        totalPoints += pointValue;
      });

      // Remove cards from collection and award points
      await database.collection('users').updateOne(
        { id: userId },
        { 
          $pull: { collection: { $or: cards.map(card => ({ id: card.id, pulledAt: card.pulledAt })) } },
          $inc: { points: totalPoints }
        }
      );

      return NextResponse.json({ 
        success: true, 
        pointsAwarded: totalPoints,
        cardsBreakdown: cards.length
      });
    }

    // Attempt to catch Pokemon
    if (pathname.includes('/api/wilds/catch')) {
      const { userId } = body;
      
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const spawn = await database.collection('global_spawn').findOne({ id: 'current' });
      
      if (!spawn || !spawn.pokemon || spawn.caughtBy) {
        return NextResponse.json({ error: 'No Pokemon available to catch' }, { status: 400 });
      }

      // Check if user has already made 3 attempts
      const userAttempts = spawn.catchAttempts[userId] || 0;
      if (userAttempts >= MAX_CATCH_ATTEMPTS) {
        return NextResponse.json({ 
          success: false, 
          fled: true, 
          message: 'The Pokemon has fled from you!'
        });
      }

      // Calculate catch chance
      const catchChance = calculateCatchChance(
        spawn.pokemon.captureRate,
        spawn.pokemon.isLegendary,
        spawn.pokemon.isMythical
      );

      // Attempt catch
      const roll = Math.random() * 100;
      const caught = roll < catchChance;

      // Update attempts
      const newAttempts = userAttempts + 1;
      const updateData = {
        [`catchAttempts.${userId}`]: newAttempts
      };

      if (caught) {
        // Pokemon caught!
        const caughtPokemon = {
          ...spawn.pokemon,
          userId: userId,
          caughtAt: new Date().toISOString(),
          spawnId: spawn.spawnedAt,
          currentXP: 0 // Initialize XP
        };

        console.log(`🎯 Pokemon Caught: ${caughtPokemon.displayName}`);
        console.log(`   isShiny: ${caughtPokemon.isShiny}`);
        console.log(`   Sprite: ${caughtPokemon.sprite}`);

        // Save to user's caught Pokemon
        await database.collection('caught_pokemon').insertOne(caughtPokemon);

        // Grant XP to all owned Pokemon (including the newly caught one)
        await applyXPToAllPokemon(userId, XP_FROM_CATCH, database);

        // Mark spawn as caught and set next spawn time
        const nextInterval = MIN_SPAWN_INTERVAL + Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
        await database.collection('global_spawn').updateOne(
          { id: 'current' },
          { 
            $set: { 
              caughtBy: userId,
              nextSpawnTime: Date.now() + nextInterval,
            }
          }
        );

        return NextResponse.json({ 
          success: true, 
          caught: true,
          pokemon: caughtPokemon,
          message: `You caught ${spawn.pokemon.displayName}!`
        });
      } else {
        // Failed attempt
        await database.collection('global_spawn').updateOne(
          { id: 'current' },
          { $set: updateData }
        );

        if (newAttempts >= MAX_CATCH_ATTEMPTS) {
          return NextResponse.json({ 
            success: false, 
            caught: false,
            fled: true,
            attemptsRemaining: 0,
            message: `${spawn.pokemon.displayName} has fled!`
          });
        }

        return NextResponse.json({ 
          success: false, 
          caught: false,
          fled: false,
          attemptsRemaining: MAX_CATCH_ATTEMPTS - newAttempts,
          catchChance: Math.round(catchChance),
          message: `${spawn.pokemon.displayName} broke free!`
        });
      }
    }

    // Admin: Force spawn a new Pokemon (Spheal only)
    if (pathname.includes('/api/wilds/admin-spawn')) {
      const { adminId, pokemonId } = body;
      
      if (!adminId) {
        return NextResponse.json({ error: 'Admin ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const admin = await database.collection('users').findOne({ id: adminId });
      
      if (!admin || admin.username !== 'Spheal') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }

      const resolvedPokemonId = await resolvePokemonIdFromQuery(pokemonId);
      const spawnId = resolvedPokemonId || (Math.floor(Math.random() * MAX_POKEMON_ID) + 1);
      const pokemonData = await fetchPokemonData(spawnId);
      
      // Add level and stats
      pokemonData.level = Math.floor(Math.random() * 46) + 5;
      pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);
      
      const newSpawn = {
        id: 'current',
        pokemon: pokemonData,
        spawnedAt: Date.now(),
        nextSpawnTime: null,
        caughtBy: null,
        catchAttempts: {}
      };
      
      await database.collection('global_spawn').updateOne(
        { id: 'current' },
        { $set: newSpawn },
        { upsert: true }
      );

      return NextResponse.json({ 
        success: true, 
        spawn: newSpawn,
        message: `Spawned ${pokemonData.displayName} (#${spawnId})!`
      });
    }

    // Admin: Force spawn a SHINY Pokemon (Spheal only)
    if (pathname.includes('/api/wilds/admin-spawn-shiny')) {
      const { adminId, pokemonId } = body;
      
      if (!adminId) {
        return NextResponse.json({ error: 'Admin ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const admin = await database.collection('users').findOne({ id: adminId });
      
      if (!admin || admin.username !== 'Spheal') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }

      const resolvedPokemonId = await resolvePokemonIdFromQuery(pokemonId);
      const spawnId = resolvedPokemonId || (Math.floor(Math.random() * MAX_POKEMON_ID) + 1);
      const pokemonData = await fetchPokemonData(spawnId, true);
      
      console.log(`✨✨ ADMIN SHINY SPAWN #${spawnId}: ${pokemonData.displayName}`);
      console.log(`   isShiny: ${pokemonData.isShiny}`);
      console.log(`   Sprite: ${pokemonData.sprite}`);
      
      // VERIFY it's actually shiny
      if (!pokemonData.isShiny) {
        console.error(`❌ ERROR: Pokemon isShiny is false!`);
      }
      if (!pokemonData.sprite.includes('/shiny/')) {
        console.error(`❌ ERROR: Sprite URL does not contain /shiny/: ${pokemonData.sprite}`);
      }
      
      // Add level and stats
      pokemonData.level = Math.floor(Math.random() * 46) + 5;
      pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);
      
      const newSpawn = {
        id: 'current',
        pokemon: pokemonData,
        spawnedAt: Date.now(),
        nextSpawnTime: null,
        caughtBy: null,
        catchAttempts: {}
      };
      
      await database.collection('global_spawn').updateOne(
        { id: 'current' },
        { $set: newSpawn },
        { upsert: true }
      );

      return NextResponse.json({ 
        success: true, 
        spawn: newSpawn,
        message: `Spawned SHINY ${pokemonData.displayName}! ✨`
      });
    }

    // Update Pokemon nickname
    if (pathname.includes('/api/wilds/update-nickname')) {
      const { userId, pokemonId, nickname } = body;
      
      if (!userId || !pokemonId) {
        return NextResponse.json({ error: 'User ID and Pokemon ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Update the specific Pokemon's nickname
      const result = await database.collection('caught_pokemon').updateOne(
        { _id: new ObjectId(pokemonId), userId: userId },
        { $set: { nickname: nickname || null } }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Nickname updated'
      });
    }

    // Update Pokemon moveset
    if (pathname.includes('/api/wilds/update-moveset')) {
      const { userId, pokemonId, moveset } = body;
      
      if (!userId || !pokemonId || !moveset || !Array.isArray(moveset)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      if (moveset.length !== 4) {
        return NextResponse.json({ error: 'Moveset must have exactly 4 moves' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Get the Pokemon to verify moves are learnable
      const pokemon = await database.collection('caught_pokemon').findOne({ 
        _id: new ObjectId(pokemonId), 
        userId: userId 
      });

      if (!pokemon) {
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      // Verify all moves are in the Pokemon's learnable moves
      const invalidMoves = moveset.filter(move => !pokemon.allMoves.includes(move));
      if (invalidMoves.length > 0) {
        return NextResponse.json({ 
          error: `Invalid moves: ${invalidMoves.join(', ')}` 
        }, { status: 400 });
      }

      // Update moveset
      await database.collection('caught_pokemon').updateOne(
        { _id: new ObjectId(pokemonId), userId: userId },
        { $set: { moveset: moveset } }
      );

      return NextResponse.json({ 
        success: true,
        message: 'Moveset updated'
      });
    }

    // Buy XP for a specific Pokemon
    if (pathname.includes('/api/wilds/buy-xp')) {
      const { userId, pokemonId, xpAmount } = body;
      
      if (!userId || !pokemonId) {
        return NextResponse.json({ error: 'User ID and Pokemon ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      const parsedXpAmount = Number(xpAmount);
      const purchaseAmount = Number.isFinite(parsedXpAmount) ? Math.floor(parsedXpAmount) : XP_PER_PURCHASE;
      const purchaseCost = purchaseAmount;

      if (!Number.isInteger(purchaseAmount) || purchaseAmount <= 0) {
        return NextResponse.json({ error: 'XP amount must be a positive whole number' }, { status: 400 });
      }

      // Get user to check points
      const user = await database.collection('users').findOne({ id: userId });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if user has enough points (Spheal always has enough)
      if (user.username !== 'Spheal' && user.points < purchaseCost) {
        return NextResponse.json({ 
          error: 'Insufficient points',
          pointsNeeded: purchaseCost - user.points
        }, { status: 400 });
      }

      // Get the Pokemon
      const pokemon = await database.collection('caught_pokemon').findOne({
        _id: new ObjectId(pokemonId),
        userId: userId
      });

      if (!pokemon) {
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      // Check if already max level
      if (pokemon.level >= MAX_LEVEL) {
        return NextResponse.json({ 
          error: 'Pokemon is already at max level'
        }, { status: 400 });
      }

      // Deduct points
      const newPoints = user.username === 'Spheal' ? 999999 : user.points - purchaseCost;
      await database.collection('users').updateOne(
        { id: userId },
        { $set: { points: newPoints } }
      );

      // Add XP to the Pokemon
      const currentXP = (pokemon.currentXP || 0) + purchaseAmount;
      const currentLevel = pokemon.level || 1;
      
      let newLevel = currentLevel;
      let remainingXP = currentXP;
      
      // Check if we can level up
      while (newLevel < MAX_LEVEL) {
        const xpNeeded = getXPToNextLevel(newLevel);
        if (remainingXP >= xpNeeded) {
          remainingXP -= xpNeeded;
          newLevel++;
        } else {
          break;
        }
      }
      
      // If at max level, set XP to 0
      if (newLevel >= MAX_LEVEL) {
        remainingXP = 0;
      }
      
      const updateData = {
        currentXP: remainingXP,
        level: newLevel
      };
      
      // Recalculate stats if level changed
      if (newLevel !== currentLevel) {
        updateData.stats = calculateStats(pokemon.baseStats, pokemon.ivs, newLevel);
      }
      
      await database.collection('caught_pokemon').updateOne(
        { _id: new ObjectId(pokemonId) },
        { $set: updateData }
      );

      return NextResponse.json({
        success: true,
        newLevel: newLevel,
        currentXP: remainingXP,
        leveledUp: newLevel !== currentLevel,
        pointsRemaining: newPoints,
        xpPurchased: purchaseAmount
      });
    }


    // Evolution item shop catalog
    if (pathname.includes('/api/wilds/items/catalog')) {
      const items = await getEvolutionItemsCatalog();
      return NextResponse.json({ success: true, items });
    }

    // Buy evolution item
    if (pathname.includes('/api/wilds/items/buy')) {
      const { userId, itemName } = body;
      if (!userId || !itemName) {
        return NextResponse.json({ error: 'User ID and item required' }, { status: 400 });
      }
      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const items = await getEvolutionItemsCatalog();
      const item = items.find(i => i.itemName === itemName);
      if (!item) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
      if (user.username !== 'Spheal' && user.points < EVOLUTION_ITEM_COST) {
        return NextResponse.json({ error: 'Insufficient points', pointsNeeded: EVOLUTION_ITEM_COST - user.points }, { status: 400 });
      }
      const newPoints = user.username === 'Spheal' ? 999999 : user.points - EVOLUTION_ITEM_COST;
      await database.collection('users').updateOne(
        { id: userId },
        { $set: { points: newPoints }, $inc: { [`inventoryItems.${itemName}`]: 1 } }
      );
      return NextResponse.json({ success: true, item, pointsRemaining: newPoints });
    }

    // Get inventory
    if (pathname.includes('/api/wilds/items/inventory')) {
      const { userId } = body;
      if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId }, { projection: { inventoryItems: 1 } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const items = await getEvolutionItemsCatalog();
      const inventoryMap = user.inventoryItems || {};
      const inventory = items.filter(item => (inventoryMap[item.itemName] || 0) > 0).map(item => ({ ...item, count: inventoryMap[item.itemName] || 0 }));
      return NextResponse.json({ success: true, inventory });
    }

    // List compatible Pokemon for an item
    if (pathname.includes('/api/wilds/items/compatible')) {
      const { userId, itemName } = body;
      if (!userId || !itemName) return NextResponse.json({ error: 'User ID and item required' }, { status: 400 });
      const database = await connectDB();
      const pokemonList = await database.collection('caught_pokemon').find({ userId }).toArray();
      const compatible = [];
      for (const pokemon of pokemonList) {
        const evolutionData = getSpecialEvolutionData(pokemon, itemName) || await fetchEvolutionChain(pokemon.id);
        if (evolutionData?.canEvolve && evolutionData.itemName === itemName) {
          compatible.push({
            _id: pokemon._id,
            displayName: pokemon.displayName,
            nickname: pokemon.nickname || '',
            sprite: pokemon.sprite,
            level: pokemon.level,
            evolvesTo: evolutionData.evolvesTo,
          });
        }
      }
      return NextResponse.json({ success: true, pokemon: compatible });
    }

    // Use evolution item
    if (pathname.includes('/api/wilds/items/use')) {
      const { userId, itemName, pokemonId } = body;
      if (!userId || !itemName || !pokemonId) return NextResponse.json({ error: 'User ID, item, and Pokemon required' }, { status: 400 });
      const database = await connectDB();
      const user = await database.collection('users').findOne({ id: userId }, { projection: { inventoryItems: 1 } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if ((user.inventoryItems?.[itemName] || 0) < 1) {
        return NextResponse.json({ error: 'Item not in inventory' }, { status: 400 });
      }
      const pokemon = await database.collection('caught_pokemon').findOne({ _id: new ObjectId(pokemonId), userId });
      if (!pokemon) return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      const evolutionData = getSpecialEvolutionData(pokemon, itemName) || await fetchEvolutionChain(pokemon.id);
      if (!evolutionData?.canEvolve || evolutionData.itemName !== itemName) {
        return NextResponse.json({ error: 'This item cannot be used on that Pokemon' }, { status: 400 });
      }
      const evolvedData = await applyEvolutionToStoredPokemon(database, pokemon, evolutionData);
      const newCount = Math.max(0, (user.inventoryItems?.[itemName] || 0) - 1);
      await database.collection('users').updateOne({ id: userId }, { $set: { [`inventoryItems.${itemName}`]: newCount } });
      return NextResponse.json({ success: true, evolvedTo: evolvedData.displayName, message: `${pokemon.nickname || pokemon.displayName} evolved into ${evolvedData.displayName}!` });
    }

    // Evolve a Pokemon
    if (pathname.includes('/api/wilds/evolve')) {
      const { userId, pokemonId, xpAmount } = body;
      
      console.log(`🔄 Evolution request - userId: ${userId}, pokemonId: ${pokemonId}`);
      
      if (!userId || !pokemonId) {
        return NextResponse.json({ error: 'User ID and Pokemon ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Get the Pokemon
      const pokemon = await database.collection('caught_pokemon').findOne({
        _id: new ObjectId(pokemonId),
        userId: userId
      });

      if (!pokemon) {
        console.log(`❌ Pokemon not found - pokemonId: ${pokemonId}`);
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      console.log(`📊 Pokemon found: ${pokemon.displayName} (ID: ${pokemon.id}), Level: ${pokemon.level}`);

      // Fetch evolution data
      const evolutionData = getSpecialEvolutionData(pokemon) || await fetchEvolutionChain(pokemon.id);
      
      console.log(`🧬 Evolution data:`, evolutionData);
      
      if (!evolutionData.canEvolve) {
        console.log(`❌ Cannot evolve - Pokemon is fully evolved`);
        return NextResponse.json({ 
          error: 'This Pokemon cannot evolve'
        }, { status: 400 });
      }

      // Check if level requirement is met
      if (evolutionData.minLevel && pokemon.level < evolutionData.minLevel) {
        console.log(`❌ Level too low - needs ${evolutionData.minLevel}, has ${pokemon.level}`);
        return NextResponse.json({
          error: `Pokemon must be level ${evolutionData.minLevel} to evolve`,
          requiredLevel: evolutionData.minLevel
        }, { status: 400 });
      }

      // Check if it's a level-up evolution
      if (evolutionData.trigger !== 'level-up') {
        console.log(`❌ Wrong trigger type - needs ${evolutionData.trigger}`);
        return NextResponse.json({
          error: 'This Pokemon requires a special evolution method',
          trigger: evolutionData.trigger
        }, { status: 400 });
      }

      console.log(`✅ Evolution requirements met! Evolving to Pokemon ID ${evolutionData.evolvesTo}...`);

      // Fetch the evolved Pokemon data
      const evolvedData = await fetchPokemonData(evolutionData.evolvesTo, pokemon.isShiny);
      
      console.log(`📦 Evolved data fetched: ${evolvedData.displayName}`);
      
      // Prepare update: preserve level, XP, IVs, nickname, isShiny, caughtAt
      // Update: id, name, displayName, sprite, baseStats, types, allMoves, allMovesData
      const updateData = {
        id: evolvedData.id,
        name: evolvedData.name,
        displayName: evolvedData.displayName,
        sprite: evolvedData.sprite,
        types: evolvedData.types,
        baseStats: evolvedData.baseStats,
        allMoves: evolvedData.allMoves,
        allMovesData: evolvedData.allMovesData,
        captureRate: evolvedData.captureRate,
        isLegendary: evolvedData.isLegendary,
        isMythical: evolvedData.isMythical,
        // Recalculate stats with new base stats but same level and IVs
        stats: calculateStats(evolvedData.baseStats, pokemon.ivs, pokemon.level),
        // Update moveset to first 4 moves of evolved form (user can customize later)
        moveset: evolvedData.moveset
      };

      await database.collection('caught_pokemon').updateOne(
        { _id: new ObjectId(pokemonId) },
        { $set: updateData }
      );

      console.log(`🎉 Evolution complete! ${pokemon.displayName} → ${evolvedData.displayName}`);

      return NextResponse.json({
        success: true,
        evolvedTo: evolvedData.displayName,
        message: `${pokemon.nickname || pokemon.displayName} evolved into ${evolvedData.displayName}!`
      });
    }

    // Release a Pokemon (delete from collection)
    if (pathname.includes('/api/wilds/release')) {
      const { userId, pokemonId, xpAmount } = body;
      
      console.log(`🗑️ Release request - userId: ${userId}, pokemonId: ${pokemonId}`);
      
      if (!userId || !pokemonId) {
        return NextResponse.json({ error: 'User ID and Pokemon ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      // Delete the Pokemon
      const result = await database.collection('caught_pokemon').deleteOne({
        _id: new ObjectId(pokemonId),
        userId: userId
      });

      if (result.deletedCount === 0) {
        console.log(`❌ Pokemon not found for release - pokemonId: ${pokemonId}`);
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      console.log(`✅ Pokemon released successfully`);

      return NextResponse.json({
        success: true,
        message: 'Pokemon released'
      });
    }

    // Check if a Pokemon can evolve (returns evolution data)
    if (pathname.includes('/api/wilds/check-evolution')) {
      const { pokemonId, currentLevel, gender } = body;
      
      if (!pokemonId) {
        return NextResponse.json({ error: 'Pokemon ID required' }, { status: 400 });
      }

      // Fetch evolution data
      const evolutionData = getSpecialEvolutionData({ id: pokemonId, level: currentLevel, gender }) || await fetchEvolutionChain(pokemonId);
      
      return NextResponse.json(evolutionData);
    }

    // ===== BATTLE SYSTEM ENDPOINTS =====
    
    // Send battle request
    if (pathname.includes('/api/battles/request')) {
      const { fromUserId, toUserId } = body;
      
      if (!fromUserId || !toUserId) {
        return NextResponse.json({ error: 'User IDs required' }, { status: 400 });
      }

      const database = await connectDB();
      
      const fromUser = await database.collection('users').findOne({ id: fromUserId });
      const toUser = await database.collection('users').findOne({ id: toUserId });
      
      if (!fromUser || !toUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const existingBattleRequest = [...(toUser.battleRequests || []), ...(fromUser.battleRequests || [])].find((request) =>
        request.status === 'pending' && (
          (request.from?.id === fromUserId && request.to?.id === toUserId) ||
          (request.from?.id === toUserId && request.to?.id === fromUserId)
        )
      );

      if (existingBattleRequest) {
        return NextResponse.json({ error: 'Only one pending battle request is allowed between these users at a time' }, { status: 409 });
      }

      // Create battle request
      const battleRequest = {
        id: uuidv4(),
        from: { id: fromUser.id, username: fromUser.username },
        to: { id: toUser.id, username: toUser.username },
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Add to recipient's battle requests
      await database.collection('users').updateOne(
        { id: toUserId },
        { $push: { battleRequests: battleRequest } }
      );

      return NextResponse.json({ success: true, request: battleRequest });
    }

    // Accept battle request
    if (pathname.includes('/api/battles/accept')) {
      const { userId, requestId } = body;
      
      if (!userId || !requestId) {
        return NextResponse.json({ error: 'User ID and request ID required' }, { status: 400 });
      }

      const database = await connectDB();
      
      const user = await database.collection('users').findOne({ id: userId });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const request = user.battleRequests?.find(r => r.id === requestId);
      if (!request) {
        return NextResponse.json({ error: 'Battle request not found' }, { status: 404 });
      }

      // Create battle
      const battle = {
        id: uuidv4(),
        player1: {
          userId: request.from.id,
          username: request.from.username,
          pokemon: [],
          currentPokemonIndex: 0,
          ready: false
        },
        player2: {
          userId: request.to.id,
          username: request.to.username,
          pokemon: [],
          currentPokemonIndex: 0,
          ready: false
        },
        currentTurn: request.from.id,
        status: 'selecting', // selecting -> ready -> active -> finished
        winner: null,
        battleLog: [],
        createdAt: new Date().toISOString()
      };

      await database.collection('battles').insertOne(battle);

      // Mark both players as actively entering this battle
      await database.collection('users').updateMany(
        { id: { $in: [request.from.id, request.to.id] } },
        { $set: { activeBattleId: battle.id } }
      );

      // Remove battle request
      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { battleRequests: { id: requestId } } }
      );

      return NextResponse.json({ success: true, battle });
    }

    // Decline battle request
    if (pathname.includes('/api/battles/decline')) {
      const { userId, requestId } = body;
      
      if (!userId || !requestId) {
        return NextResponse.json({ error: 'User ID and request ID required' }, { status: 400 });
      }

      const database = await connectDB();

      await database.collection('users').updateOne(
        { id: userId },
        { $pull: { battleRequests: { id: requestId } } }
      );

      return NextResponse.json({ success: true });
    }

    // Select Pokemon for battle
    if (pathname.includes('/api/battles/select-pokemon')) {
      const { battleId, userId, pokemonIds } = body;
      
      if (!battleId || !userId || !pokemonIds || !Array.isArray(pokemonIds)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      if (pokemonIds.length > 6 || pokemonIds.length === 0) {
        return NextResponse.json({ error: 'Must select 1-6 Pokemon' }, { status: 400 });
      }

      const database = await connectDB();
      const battle = await database.collection('battles').findOne({ id: battleId });
      
      if (!battle) {
        return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
      }

      // Fetch the Pokemon from database
      const pokemon = await database.collection('caught_pokemon')
        .find({ 
          _id: { $in: pokemonIds.map(id => new ObjectId(id)) },
          userId: userId
        })
        .toArray();

      // Add battle state to each Pokemon (start at max HP)
      const pokemonWithHP = pokemon.map(p => ({
        ...p,
        currentHP: p.stats.hp,
        maxHP: p.stats.hp,
        statusCondition: null,
        sleepTurns: 0
      }));

      // Determine which player and update
      const isPlayer1 = battle.player1.userId === userId;
      const playerField = isPlayer1 ? 'player1' : 'player2';

      await database.collection('battles').updateOne(
        { id: battleId },
        { 
          $set: { 
            [`${playerField}.pokemon`]: pokemonWithHP,
            [`${playerField}.ready`]: true
          }
        }
      );

      // Check if both players are ready
      const updatedBattle = await database.collection('battles').findOne({ id: battleId });
      if (updatedBattle.player1.ready && updatedBattle.player2.ready) {
        await database.collection('battles').updateOne(
          { id: battleId },
          { $set: { status: 'active' } }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Switch Pokemon after a faint
    if (pathname.includes('/api/battles/switch-pokemon')) {
      const { battleId, userId, pokemonIndex } = body;

      if (!battleId || !userId || pokemonIndex === undefined) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      const database = await connectDB();
      const battle = await database.collection('battles').findOne({ id: battleId });

      if (!battle || battle.status !== 'active') {
        return NextResponse.json({ error: 'Battle not active' }, { status: 400 });
      }

      if (battle.awaitingSwitchFor !== userId) {
        return NextResponse.json({ error: 'No switch needed right now' }, { status: 400 });
      }

      const isPlayer1 = battle.player1.userId === userId;
      const playerField = isPlayer1 ? 'player1' : 'player2';
      const player = isPlayer1 ? battle.player1 : battle.player2;
      const chosenPokemon = player.pokemon?.[pokemonIndex];

      if (!chosenPokemon) {
        return NextResponse.json({ error: 'Pokemon not found' }, { status: 404 });
      }

      if (chosenPokemon.currentHP <= 0) {
        return NextResponse.json({ error: 'That Pokemon has fainted' }, { status: 400 });
      }

      if (pokemonIndex === player.currentPokemonIndex) {
        return NextResponse.json({ error: 'That Pokemon is already active' }, { status: 400 });
      }

      await database.collection('battles').updateOne(
        { id: battleId },
        {
          $set: {
            [`${playerField}.currentPokemonIndex`]: pokemonIndex,
            awaitingSwitchFor: null
          },
          $push: {
            battleLog: {
              turn: battle.battleLog.length + 1,
              type: 'switch',
              player: player.username,
              pokemon: chosenPokemon.displayName,
              timestamp: new Date().toISOString()
            }
          }
        }
      );

      return NextResponse.json({ success: true });
    }

    // Get battle state
    if (pathname.includes('/api/battles/state')) {
      const { battleId } = body;
      
      if (!battleId) {
        return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
      }

      const database = await connectDB();
      const battle = await database.collection('battles').findOne({ id: battleId });
      
      if (!battle) {
        return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
      }

      return NextResponse.json({ battle });
    }

    // Perform battle action (attack)
    if (pathname.includes('/api/battles/attack')) {
      const { battleId, userId, moveIndex } = body;
      
      if (!battleId || !userId || moveIndex === undefined) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      const database = await connectDB();
      const battle = await database.collection('battles').findOne({ id: battleId });
      
      if (!battle || battle.status !== 'active') {
        return NextResponse.json({ error: 'Battle not active' }, { status: 400 });
      }

      if (battle.awaitingSwitchFor) {
        return NextResponse.json({ error: 'A player must choose their next Pokemon first' }, { status: 400 });
      }

      if (battle.currentTurn !== userId) {
        return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
      }

      const isPlayer1 = battle.player1.userId === userId;
      const attackerField = isPlayer1 ? 'player1' : 'player2';
      const defenderField = isPlayer1 ? 'player2' : 'player1';
      const attacker = isPlayer1 ? battle.player1 : battle.player2;
      const defender = isPlayer1 ? battle.player2 : battle.player1;

      const attackingPokemon = attacker.pokemon?.[attacker.currentPokemonIndex];
      const defendingPokemon = defender.pokemon?.[defender.currentPokemonIndex];

      if (!attackingPokemon || !defendingPokemon) {
        return NextResponse.json({ error: 'Battle Pokemon missing' }, { status: 400 });
      }

      if (attackingPokemon.currentHP <= 0) {
        return NextResponse.json({ error: 'Your active Pokemon has fainted' }, { status: 400 });
      }

      const moveName = attackingPokemon.moveset?.[moveIndex];
      const moveData = attackingPokemon.allMovesData?.find(m => m.name === moveName);

      if (!moveData) {
        return NextResponse.json({ error: 'Invalid move' }, { status: 400 });
      }

      const nextTurnUserId = defender.userId;
      const battleLogEntries = [];
      let damage = 0;
      let fainted = false;
      let battleOver = false;
      let winner = null;
      let effectiveness = 1;
      let statusApplied = null;
      let moveMissed = false;
      let turnSkipped = false;
      const updateSet = {};

      // Sleep handling
      if (attackingPokemon.statusCondition === 'sleep') {
        const remainingSleepTurns = Math.max(0, (attackingPokemon.sleepTurns || 0) - 1);
        if (remainingSleepTurns > 0) {
          turnSkipped = true;
          updateSet[`${attackerField}.pokemon.${attacker.currentPokemonIndex}.sleepTurns`] = remainingSleepTurns;
          updateSet.currentTurn = nextTurnUserId;
          battleLogEntries.push({
            turn: battle.battleLog.length + 1,
            type: 'status',
            attacker: attacker.username,
            move: formatMoveName(moveName),
            message: `${attackingPokemon.displayName} is fast asleep!`,
            timestamp: new Date().toISOString()
          });
        } else {
          updateSet[`${attackerField}.pokemon.${attacker.currentPokemonIndex}.sleepTurns`] = 0;
          updateSet[`${attackerField}.pokemon.${attacker.currentPokemonIndex}.statusCondition`] = null;
          battleLogEntries.push({
            turn: battle.battleLog.length + 1,
            type: 'status',
            attacker: attacker.username,
            move: formatMoveName(moveName),
            message: `${attackingPokemon.displayName} woke up!`,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (!turnSkipped) {
        if (moveData.accuracy && Math.random() * 100 > moveData.accuracy) {
          moveMissed = true;
          updateSet.currentTurn = nextTurnUserId;
          battleLogEntries.push({
            turn: battle.battleLog.length + battleLogEntries.length + 1,
            type: 'miss',
            attacker: attacker.username,
            defender: defender.username,
            move: formatMoveName(moveName),
            message: `${attackingPokemon.displayName}'s ${formatMoveName(moveName)} missed!`,
            timestamp: new Date().toISOString()
          });
        } else {
          const damageResult = calculateDamage(attackingPokemon, defendingPokemon, moveData);
          damage = damageResult.damage;
          effectiveness = damageResult.multiplier;
          const newHP = Math.max(0, defendingPokemon.currentHP - damage);
          fainted = newHP === 0;

          updateSet[`${defenderField}.pokemon.${defender.currentPokemonIndex}.currentHP`] = newHP;

          const moveMessageParts = [
            `${attackingPokemon.displayName} used ${formatMoveName(moveName)}!`,
            `It dealt ${damage} damage.`
          ];
          if (damageResult.isCritical) moveMessageParts.push('A critical hit!');
          if (effectiveness >= 2) moveMessageParts.push(`It's super effective!`);
          if (effectiveness > 0 && effectiveness < 1) moveMessageParts.push(`It's not very effective...`);
          if (effectiveness === 0) moveMessageParts.push(`It had no effect.`);

          battleLogEntries.push({
            turn: battle.battleLog.length + battleLogEntries.length + 1,
            type: 'attack',
            attacker: attacker.username,
            defender: defender.username,
            move: formatMoveName(moveName),
            damage,
            multiplier: effectiveness,
            message: moveMessageParts.join(' '),
            timestamp: new Date().toISOString()
          });

          if (
            moveData.damageClass !== 'status' &&
            !defendingPokemon.statusCondition &&
            moveData.ailment === 'sleep' &&
            (moveData.ailmentChance || moveData.effectChance || 100) > 0 &&
            Math.random() * 100 <= (moveData.ailmentChance || moveData.effectChance || 100)
          ) {
            const sleepTurns = Math.floor(Math.random() * 3) + 1;
            updateSet[`${defenderField}.pokemon.${defender.currentPokemonIndex}.statusCondition`] = 'sleep';
            updateSet[`${defenderField}.pokemon.${defender.currentPokemonIndex}.sleepTurns`] = sleepTurns;
            statusApplied = 'sleep';
            battleLogEntries.push({
              turn: battle.battleLog.length + battleLogEntries.length + 1,
              type: 'status',
              attacker: attacker.username,
              defender: defender.username,
              move: formatMoveName(moveName),
              message: `${defendingPokemon.displayName} fell asleep!`,
              timestamp: new Date().toISOString()
            });
          }

          if (fainted) {
            battleLogEntries.push({
              turn: battle.battleLog.length + battleLogEntries.length + 1,
              type: 'faint',
              attacker: attacker.username,
              defender: defender.username,
              move: formatMoveName(moveName),
              message: `${defendingPokemon.displayName} fainted!`,
              timestamp: new Date().toISOString()
            });

            const remainingAliveIndexes = defender.pokemon
              .map((pokemon, index) => ({ pokemon, index }))
              .filter(({ pokemon, index }) => index !== defender.currentPokemonIndex && pokemon.currentHP > 0);

            if (remainingAliveIndexes.length === 0) {
              battleOver = true;
              winner = userId;
              updateSet.status = 'finished';
              updateSet.winner = userId;
            } else {
              updateSet.awaitingSwitchFor = defender.userId;
              updateSet.currentTurn = defender.userId;
            }
          } else {
            updateSet.currentTurn = nextTurnUserId;
          }
        }
      }

      await database.collection('battles').updateOne(
        { id: battleId },
        {
          $set: updateSet,
          ...(battleLogEntries.length ? { $push: { battleLog: { $each: battleLogEntries } } } : {})
        }
      );

      if (battleOver) {
        await database.collection('users').updateMany(
          { id: { $in: [battle.player1.userId, battle.player2.userId] } },
          { $unset: { activeBattleId: '' } }
        );
      }

      return NextResponse.json({
        success: true,
        damage,
        fainted,
        battleOver,
        winner,
        effectiveness,
        statusApplied,
        moveMissed,
        turnSkipped,
        awaitingSwitchFor: updateSet.awaitingSwitchFor || null
      });
    }

    // Forfeit battle
    if (pathname.includes('/api/battles/forfeit')) {
      const { battleId, userId } = body;
      
      if (!battleId || !userId) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      const database = await connectDB();
      const battle = await database.collection('battles').findOne({ id: battleId });
      
      if (!battle) {
        return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
      }

      const winner = battle.player1.userId === userId ? battle.player2.userId : battle.player1.userId;

      await database.collection('battles').updateOne(
        { id: battleId },
        { 
          $set: { 
            status: 'finished',
            winner: winner
          }
        }
      );

      await database.collection('users').updateMany(
        { id: { $in: [battle.player1.userId, battle.player2.userId] } },
        { $unset: { activeBattleId: '' } }
      );

      return NextResponse.json({ success: true, winner });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
  console.error('POST Error:', {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
    cause: error?.cause,
  });
  return NextResponse.json(
    {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    },
    { status: 500 }
  );
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