import { calculateStats, fetchPokemonData, normalizeStoredSprite } from '@/lib/wilds';

export const SAFARI_ZONE_COST = 2000;
export const SAFARI_MIN_RESPAWN_MS = 20 * 1000;
export const SAFARI_MAX_RESPAWN_MS = 60 * 1000;
export const SAFARI_SHINY_RATE = 1 / 800;
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
    commons: [16, 17, 21, 41, 66, 74, 95, 104, 111, 207, 227, 231, 246, 296, 299, 371, 396, 425, 436, 443, 519, 524, 527, 529, 557, 580, 610, 627],
    uncommons: [18, 22, 42, 67, 82, 112, 142, 208, 247, 305, 372, 397, 437, 444, 525, 528, 530, 558, 581, 611, 628],
    rares: [68, 76, 149, 248, 330, 373],
    legendaries: [145, 249, 250, 384, 644],
    mythicals: [385],
  },
  {
    key: 'desert',
    name: 'Desert',
    description: 'A harsh desert with ground-types, psychic relics, and ancient legends.',
    backgroundPath: '/safari-zone/desert.jpg',
    commons: [23, 27, 50, 74, 95, 104, 111, 206, 207, 218, 228, 231, 246, 290, 322, 328, 331, 343, 449, 529, 551, 554, 556, 619, 622],
    uncommons: [24, 28, 51, 75, 105, 112, 208, 232, 291, 323, 329, 332, 344, 450, 552, 553, 623],
    rares: [31, 34, 330, 332, 449, 450],
    legendaries: [377, 379, 383],
    mythicals: [720],
  },
  {
    key: 'plains',
    name: 'Plains',
    description: 'Wide-open grasslands where normal, electric, and fighting Pokémon gather.',
    backgroundPath: '/safari-zone/plains.jpg',
    commons: [19, 20, 29, 32, 39, 52, 56, 77, 84, 96, 161, 163, 179, 190, 203, 216, 263, 293, 399, 403, 417, 427, 504, 519, 572, 626],
    uncommons: [30, 33, 53, 57, 78, 85, 97, 162, 164, 180, 264, 294, 397, 400, 404, 418, 428, 505, 573],
    rares: [128, 135, 241, 335, 573, 626],
    legendaries: [243, 244, 245, 638, 639, 640],
    mythicals: [480, 481, 482, 494],
  },
  {
    key: 'forest',
    name: 'Forest',
    description: 'A lively woodland filled with bug, grass, and bird Pokémon.',
    backgroundPath: '/safari-zone/forest.jpg',
    commons: [10, 11, 13, 14, 16, 43, 44, 46, 69, 70, 84, 163, 165, 191, 204, 261, 265, 273, 285, 315, 396, 399, 412, 420, 540, 548, 590, 661],
    uncommons: [12, 15, 17, 18, 45, 47, 71, 123, 166, 167, 182, 205, 268, 269, 274, 286, 407, 413, 421, 541, 542, 549, 591],
    rares: [46, 47, 123, 127, 214, 286, 357],
    legendaries: [251, 492],
    mythicals: [480, 481, 482, 649],
  },
  {
    key: 'jungle',
    name: 'Jungle',
    description: 'Dense undergrowth where poison, fighting, and exotic rare Pokémon hide.',
    backgroundPath: '/safari-zone/jungle.jpg',
    commons: [1, 2, 43, 46, 48, 69, 70, 102, 114, 167, 187, 191, 273, 285, 406, 420, 455, 511, 540, 590, 597, 607],
    uncommons: [3, 45, 47, 49, 71, 103, 115, 168, 188, 274, 286, 315, 407, 421, 454, 512, 541, 542, 591, 598],
    rares: [65, 123, 214, 272, 275, 463],
    legendaries: [641, 642, 645],
    mythicals: [251, 493],
  },
  {
    key: 'volcano',
    name: 'Volcano',
    description: 'A blazing caldera home to fire-types, dragons, and molten legends.',
    backgroundPath: '/safari-zone/volcano.jpg',
    commons: [4, 5, 37, 58, 77, 126, 136, 155, 218, 228, 240, 255, 322, 324, 390, 498, 554, 607, 631, 636, 653],
    uncommons: [6, 38, 59, 78, 157, 219, 221, 229, 256, 323, 467, 499, 500, 609, 637],
    rares: [59, 229, 324, 330, 500, 637],
    legendaries: [146, 250, 485, 643],
    mythicals: [494],
  },
  {
    key: 'snowy-tundra',
    name: 'Snowy Tundra',
    description: 'A frozen expanse where ice and steel Pokémon survive the cold.',
    backgroundPath: '/safari-zone/snowy-tundra.png',
    commons: [86, 87, 124, 215, 220, 225, 238, 361, 363, 393, 459, 582, 613, 712],
    uncommons: [91, 131, 221, 362, 364, 460, 473, 478, 583, 614, 615, 713],
    rares: [131, 225, 365, 473, 615],
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
