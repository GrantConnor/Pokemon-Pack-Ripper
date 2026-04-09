import axios from 'axios';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
export const MAX_POKEMON_ID = 1010;
const MIN_SPAWN_INTERVAL = 5 * 60 * 1000;
const MAX_SPAWN_INTERVAL = 10 * 60 * 1000;
const MASS_OUTBREAK_DURATION_MS = 10 * 60 * 1000;
const MASS_OUTBREAK_RESPAWN_MS = 60 * 1000;
const MASS_OUTBREAK_SHINY_RATE = 1 / 1000;
const MASS_OUTBREAK_START_CHANCE = 0.06;


function randomSpawnInterval() {
  return MIN_SPAWN_INTERVAL + Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL);
}

export function calculateStats(baseStats, ivs, level) {
  const hp = Math.floor(((2 * baseStats.hp + ivs.hp) * level) / 100) + level + 10;
  const attack = Math.floor(((2 * baseStats.attack + ivs.attack) * level) / 100) + 5;
  const defense = Math.floor(((2 * baseStats.defense + ivs.defense) * level) / 100) + 5;
  const spAttack = Math.floor(((2 * baseStats.spAttack + ivs.spAttack) * level) / 100) + 5;
  const spDefense = Math.floor(((2 * baseStats.spDefense + ivs.spDefense) * level) / 100) + 5;
  const speed = Math.floor(((2 * baseStats.speed + ivs.speed) * level) / 100) + 5;
  return { hp, attack, defense, spAttack, spDefense, speed };
}

export function buildPokemonSprite(pokemon, pokemonId, isShiny = false) {
  const officialArtwork = pokemon?.sprites?.other?.['official-artwork'];
  const homeArtwork = pokemon?.sprites?.other?.home;

  if (isShiny) {
    return (
      homeArtwork?.front_shiny ||
      officialArtwork?.front_shiny ||
      pokemon?.sprites?.front_shiny ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonId}.png`
    );
  }

  return (
    officialArtwork?.front_default ||
    homeArtwork?.front_default ||
    pokemon?.sprites?.front_default ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
  );
}

export function normalizeStoredSprite(pokemonData) {
  if (!pokemonData?.id) return pokemonData;
  if (pokemonData.isShiny) {
    return {
      ...pokemonData,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonData.id}.png`
    };
  }
  return {
    ...pokemonData,
    sprite: pokemonData.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonData.id}.png`
  };
}

export async function fetchPokemonData(pokemonId, forceShiny = false, shinyRate = 1 / 4000) {
  const pokemonResponse = await axios.get(`${POKEAPI_BASE}/pokemon/${pokemonId}`);
  const pokemon = pokemonResponse.data;

  const speciesResponse = await axios.get(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`);
  const species = speciesResponse.data;

  const isShiny = forceShiny || (Math.random() < shinyRate);
  const types = pokemon.types.map(t => t.type.name);
  const sprite = buildPokemonSprite(pokemon, pokemonId, isShiny);

  const movePromises = pokemon.moves
    .filter(m => {
      const details = m.version_group_details;
      return details.some(d => d.move_learn_method.name === 'level-up' || d.move_learn_method.name === 'machine');
    })
    .slice(0, 50)
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
          statChanges: moveData.data.stat_changes.map(sc => ({ stat: sc.stat.name, change: sc.change })),
        };
      } catch {
        return { name: m.move.name, power: null, accuracy: null, type: 'normal', damageClass: 'status' };
      }
    });

  const allMovesData = await Promise.all(movePromises);
  const allMoveNames = allMovesData.map(m => m.name);

  const ivs = {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAttack: Math.floor(Math.random() * 32),
    spDefense: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };

  const shuffledMoves = [...allMovesData].sort(() => 0.5 - Math.random());
  const moveset = shuffledMoves.slice(0, Math.min(4, allMovesData.length)).map(m => m.name);

  let gender = null;
  if (species.gender_rate === -1) gender = 'genderless';
  else if (species.gender_rate === 0) gender = 'male';
  else if (species.gender_rate === 8) gender = 'female';
  else gender = Math.random() < (species.gender_rate / 8) ? 'female' : 'male';

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: species.names.find(n => n.language.name === 'en')?.name || pokemon.name,
    types,
    sprite,
    isShiny,
    captureRate: species.capture_rate,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    gender,
    ivs,
    moveset,
    allMoves: allMoveNames,
    allMovesData,
    nickname: null,
    baseStats: {
      hp: pokemon.stats[0].base_stat,
      attack: pokemon.stats[1].base_stat,
      defense: pokemon.stats[2].base_stat,
      spAttack: pokemon.stats[3].base_stat,
      spDefense: pokemon.stats[4].base_stat,
      speed: pokemon.stats[5].base_stat,
    },
  };
}


function buildMassOutbreakState(pokemonData, now) {
  return {
    active: true,
    pokemonId: pokemonData.id,
    pokemonName: pokemonData.displayName,
    startedAt: now,
    endsAt: now + MASS_OUTBREAK_DURATION_MS,
    shinyRate: MASS_OUTBREAK_SHINY_RATE,
    respawnDelayMs: MASS_OUTBREAK_RESPAWN_MS,
  };
}

function isMassOutbreakActive(spawn, now = Date.now()) {
  return !!(spawn?.outbreak?.active && spawn?.outbreak?.endsAt && now < spawn.outbreak.endsAt);
}

function normalizeOutbreakState(spawn, now = Date.now()) {
  if (!spawn?.outbreak) return null;
  if (isMassOutbreakActive(spawn, now)) return spawn.outbreak;
  return null;
}

async function createWildSpawn(now, outbreak = null) {
  if (outbreak?.active && outbreak?.pokemonId) {
    const pokemonData = await fetchPokemonData(outbreak.pokemonId, false, outbreak.shinyRate || MASS_OUTBREAK_SHINY_RATE);
    pokemonData.level = Math.floor(Math.random() * 46) + 5;
    pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);
    return {
      id: 'current',
      pokemon: pokemonData,
      spawnedAt: now,
      spawnEndsAt: outbreak.endsAt,
      nextSpawnTime: null,
      caughtBy: null,
      catchAttempts: {},
      outbreak,
    };
  }

  let randomId;
  let pokemonData;
  let attempts = 0;
  const maxAttempts = 5;

  do {
    randomId = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
    pokemonData = await fetchPokemonData(randomId);
    attempts++;
    if (pokemonData.isLegendary || pokemonData.isMythical) {
      const allowRare = Math.random() < 0.10;
      if (!allowRare && attempts < maxAttempts) continue;
    }
    break;
  } while (attempts < maxAttempts);

  const startedOutbreak = Math.random() < MASS_OUTBREAK_START_CHANCE;
  if (startedOutbreak) {
    pokemonData = await fetchPokemonData(pokemonData.id, false, MASS_OUTBREAK_SHINY_RATE);
  }

  pokemonData.level = Math.floor(Math.random() * 46) + 5;
  pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);

  const activeOutbreak = startedOutbreak ? buildMassOutbreakState(pokemonData, now) : null;

  return {
    id: 'current',
    pokemon: pokemonData,
    spawnedAt: now,
    spawnEndsAt: activeOutbreak ? activeOutbreak.endsAt : (now + randomSpawnInterval()),
    nextSpawnTime: null,
    caughtBy: null,
    catchAttempts: {},
    outbreak: activeOutbreak,
  };
}

export async function updateGlobalSpawn(database) {
  const globalSpawn = await database.collection('global_spawn').findOne({ id: 'current' });
  const now = Date.now();
  const outbreak = normalizeOutbreakState(globalSpawn, now);

  const needsFreshSpawn = !globalSpawn
    || (globalSpawn.caughtBy && globalSpawn.nextSpawnTime && now >= globalSpawn.nextSpawnTime)
    || (!globalSpawn.caughtBy && globalSpawn.spawnEndsAt && now >= globalSpawn.spawnEndsAt)
    || (!globalSpawn.caughtBy && !globalSpawn.spawnEndsAt);

  if (needsFreshSpawn) {
    const newSpawn = await createWildSpawn(now, outbreak);

    await database.collection('global_spawn').updateOne(
      { id: 'current' },
      { $set: newSpawn },
      { upsert: true }
    );

    return newSpawn;
  }

  if (globalSpawn?.outbreak && !outbreak) {
    const cleanedSpawn = { ...globalSpawn, outbreak: null };
    await database.collection('global_spawn').updateOne(
      { id: 'current' },
      { $set: { outbreak: null } }
    );
    return cleanedSpawn;
  }

  return globalSpawn;
}

export async function persistNormalizedPokemonSprites(database, pokemonList) {
  const writes = [];
  for (const pokemon of pokemonList) {
    if (pokemon?.isShiny && pokemon?._id) {
      const normalized = normalizeStoredSprite(pokemon);
      if (normalized.sprite !== pokemon.sprite) {
        writes.push(database.collection('caught_pokemon').updateOne({ _id: pokemon._id }, { $set: { sprite: normalized.sprite } }));
      }
    }
  }
  if (writes.length) await Promise.all(writes);
}
