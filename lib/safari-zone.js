import { calculateStats, fetchPokemonData, normalizeStoredSprite } from '@/lib/wilds';

export const SAFARI_ZONE_COST = 5000;
export const SAFARI_MIN_RESPAWN_MS = 20 * 1000;
export const SAFARI_MAX_RESPAWN_MS = 60 * 1000;
export const SAFARI_SHINY_RATE = 1 / 1000;
export const SAFARI_SNACKS_PER_RUN = 3;
export const SAFARI_DURATION_MS = 10 * 60 * 1000;

export const SAFARI_CATCH_RATES = {
  common: 65,
  uncommon: 45,
  rare: 28,
  legendary: 10,
  mythical: 6,
};

export const SAFARI_BIOMES = [
  {
    key: 'mountains',
    name: 'Mountains',
    description: 'A high-altitude range where rock, flying, and dragon Pokémon roam.',
    backgroundPath: '/safari-zone/mountains.jpg',
    commons: [16, 17, 41, 66, 74, 95, 111, 246, 304, 519],
    uncommons: [18, 42, 75, 112, 142, 247, 305, 525],
    rares: [68, 76, 149, 248, 330, 373],
    legendaries: [144, 249, 384],
    mythicals: [385],
  },
  {
    key: 'desert',
    name: 'Desert',
    description: 'A harsh desert with ground-types, psychic relics, and ancient legends.',
    backgroundPath: '/safari-zone/desert.jpg',
    commons: [27, 50, 104, 194, 207, 322, 328, 551],
    uncommons: [28, 51, 105, 208, 329, 552, 556],
    rares: [31, 34, 330, 332, 449, 450],
    legendaries: [27, 377, 383],
    mythicals: [561, 720],
  },
  {
    key: 'plains',
    name: 'Plains',
    description: 'Wide-open grasslands where normal, electric, and fighting Pokémon gather.',
    backgroundPath: '/safari-zone/plains.jpg',
    commons: [19, 20, 39, 52, 56, 84, 96, 161, 179, 263, 396, 399],
    uncommons: [53, 57, 85, 97, 162, 180, 264, 397, 400, 417],
    rares: [128, 135, 241, 335, 573, 626],
    legendaries: [243, 640],
    mythicals: [494],
  },
  {
    key: 'forest',
    name: 'Forest',
    description: 'A lively woodland filled with bug, grass, and bird Pokémon.',
    backgroundPath: '/safari-zone/forest.jpg',
    commons: [10, 11, 13, 14, 16, 43, 44, 69, 70, 163, 191, 261, 265, 540],
    uncommons: [12, 15, 17, 18, 45, 71, 166, 182, 268, 269, 315, 542],
    rares: [46, 47, 59, 123, 127, 214, 286, 357],
    legendaries: [251, 492],
    mythicals: [251],
  },
  {
    key: 'jungle',
    name: 'Jungle',
    description: 'Dense undergrowth where poison, fighting, and exotic rare Pokémon hide.',
    backgroundPath: '/safari-zone/jungle.jpg',
    commons: [46, 48, 69, 70, 102, 114, 167, 187, 273, 285, 406, 540],
    uncommons: [47, 49, 71, 103, 115, 168, 188, 274, 286, 407, 541],
    rares: [65, 123, 214, 272, 275, 392, 455],
    legendaries: [250, 640, 641],
    mythicals: [251, 493],
  },
  {
    key: 'volcano',
    name: 'Volcano',
    description: 'A blazing caldera home to fire-types, dragons, and molten legends.',
    backgroundPath: '/safari-zone/volcano.jpg',
    commons: [4, 5, 37, 58, 77, 126, 155, 218, 240, 255, 322, 390, 498, 607],
    uncommons: [6, 38, 78, 136, 157, 219, 221, 324, 467, 500, 609, 636],
    rares: [59, 146, 229, 323, 330, 500, 637],
    legendaries: [146, 250, 643],
    mythicals: [494],
  },
  {
    key: 'snowy-tundra',
    name: 'Snowy Tundra',
    description: 'A frozen expanse where ice and steel Pokémon survive the cold.',
    backgroundPath: '/safari-zone/snowy-tundra.png',
    commons: [86, 87, 220, 361, 363, 459, 582, 712],
    uncommons: [91, 124, 221, 362, 364, 460, 583, 713],
    rares: [131, 144, 225, 365, 378, 473, 615],
    legendaries: [144, 378, 646],
    mythicals: [480],
  },
];

export function pickSafariBiome() {
  return SAFARI_BIOMES[Math.floor(Math.random() * SAFARI_BIOMES.length)];
}

export function randomSafariSpawnDelay() {
  return SAFARI_MIN_RESPAWN_MS + Math.floor(Math.random() * (SAFARI_MAX_RESPAWN_MS - SAFARI_MIN_RESPAWN_MS + 1));
}

export function pickSafariRarity() {
  const roll = Math.random();
  if (roll < 0.56) return 'common';
  if (roll < 0.82) return 'uncommon';
  if (roll < 0.95) return 'rare';
  if (roll < 0.985) return 'legendary';
  return 'mythical';
}

function poolForRarity(biome, rarity) {
  return biome[`${rarity}s`] || [];
}

export async function createSafariSpawn(biome, options = {}) {
  const rarity = pickSafariRarity();
  const pool = poolForRarity(biome, rarity);
  if (!pool.length) {
    throw new Error(`No Safari Zone spawn pool configured for ${biome.name} (${rarity})`);
  }

  const pokemonId = pool[Math.floor(Math.random() * pool.length)];
  const shinyRate = options?.shinyRate || SAFARI_SHINY_RATE;
  const pokemonData = await fetchPokemonData(pokemonId, false, shinyRate);
  pokemonData.level = Math.floor(Math.random() * 46) + 5;
  pokemonData.stats = calculateStats(pokemonData.baseStats, pokemonData.ivs, pokemonData.level);

  return normalizeStoredSprite({
    ...pokemonData,
    safariRarity: rarity,
    spawnedAt: Date.now(),
  });
}

export function getSafariCatchRate(spawn, snackApplied = false) {
  const rarity = spawn?.safariRarity || 'common';
  const base = SAFARI_CATCH_RATES[rarity] ?? SAFARI_CATCH_RATES.common;
  return Math.min(95, base + (snackApplied ? 20 : 0));
}
