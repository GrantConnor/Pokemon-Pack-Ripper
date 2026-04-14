import { calculateStats, fetchPokemonData, normalizeStoredSprite } from '@/lib/wilds';

export const SAFARI_ZONE_COST = 2000;
export const SAFARI_MIN_RESPAWN_MS = 8 * 1000;
export const SAFARI_MAX_RESPAWN_MS = 15 * 1000;
export const SAFARI_SHINY_RATE = 1 / 800;
export const SAFARI_SNACKS_PER_RUN = 3;
export const SAFARI_DURATION_MS = 5 * 60 * 1000;

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
   commons: [16, 17, 21, 41, 66, 74, 95, 104, 111, 207, 227, 231, 246, 296, 299, 371, 396, 425, 436, 443, 519, 524, 527, 529, 557, 580, 610, 627, 276, 441, 566, 629, 661, 714, 821, 50, 333, 633, 885],
    uncommons: [18, 22, 42, 67, 82, 112, 208, 247, 305, 372, 397, 437, 444, 525, 528, 530, 558, 611, 630, 822, 51, 75, 105, 329, 660, 634, 886],
    rares: [68, 76, 149, 248, 330, 373, 169, 142, 445, 472, 567, 628, 715, 823, 34, 334, 887],
    legendaries: [145, 250, 384, 644, 641, 717],
    mythicals: [385, 386, 719, 808],
  },
  {
    key: 'desert',
    name: 'Desert',
    description: 'A harsh desert with ground-types, psychic relics, and ancient legends.',
    backgroundPath: '/safari-zone/desert.jpg',
    commons: [23, 27, 50, 74, 95, 104, 111, 206, 207, 231, 246, 290, 328, 331, 343, 449, 529, 551, 554, 556, 619, 622, 194, 562],
    uncommons: [24, 28, 51, 75, 105, 112, 208, 232, 291, 323, 329, 332, 344, 450, 552, 553, 623, 556],
    rares: [31, 34, 330, 332, 449, 450, 563, 772],
    legendaries: [377, 379, 378, 645],
    mythicals: [720, 808],
  },
  {
    key: 'plains',
    name: 'Plains',
    description: 'Wide-open grasslands where normal, electric, and fighting Pokémon gather.',
    backgroundPath: '/safari-zone/plains.jpg',
    commons: [19, 29, 32, 39, 52, 56, 77, 84, 96, 161, 163, 179, 190, 216, 263, 293, 399, 403, 417, 427, 504, 519, 572, 940, 327, 300, 431, 441, 506, 659, 667, 831, 915, 916, 924, 759, 401],
    uncommons: [30, 33, 53, 20, 57, 78, 85, 97, 162, 164, 180, 264, 294, 397, 400, 404, 505, 626, 941, 203, 133, 128, 108, 234, 235, 241, 301, 352, 351, 432, 440, 507, 520, 676, 832, 876, 925, 402],
    rares: [128, 135, 241, 335, 573, 428, 40, 115, 113, 132, 162, 463, 242, 508, 521, 531, 668, 773],
    legendaries: [243, 244, 245, 638, 639, 640, 493],
    mythicals: [480, 481, 482],
  },
  {
    key: 'forest',
    name: 'Forest',
    description: 'A lively woodland filled with bug, grass, and bird Pokémon.',
    backgroundPath: '/safari-zone/forest.jpg',
    commons: [10, 11, 13, 14, 16, 43, 46, 69, 163, 165, 191, 204, 261, 265, 273, 285, 315, 412, 420, 540, 590, 585, 928, 48, 167, 290, 415, 544, 595, 665, 736, 742, 826, 917, 953, 708, 710],
    uncommons: [12, 15, 47, 166, 205, 268, 266, 269, 274, 286, 413, 421, 541, 542, 44, 70, 267, 168, 591, 586, 929, 193, 291, 313, 314, 414, 545, 596, 632, 666, 743, 737, 918, 709, 711],
    rares: [123, 127, 214, 286, 930, 71, 407, 45, 182, 292, 738, 794, 795],
    legendaries: [251, 492],
    mythicals: [649, 648, 720],
  },
  {
    key: 'jungle',
    name: 'Jungle',
    description: 'Dense undergrowth where poison, fighting, and exotic rare Pokémon hide.',
    backgroundPath: '/safari-zone/jungle.jpg',
    commons: [1, 2, 43, 46, 48, 69, 102, 114, 167, 187, 191, 273, 285, 406, 420, 511, 540, 590, 597, 287, 731, 152, 453, 252, 270, 387, 495, 546, 548, 650, 672, 755, 761, 840, 906, 946, 951],
    uncommons: [3, 47, 49, 103, 168, 188, 274, 315, 421, 454, 512, 541, 542, 591, 598, 741, 288, 732, 981, 70, 455, 153, 154, 253, 254, 189, 192, 388, 389, 496, 497, 547, 549, 651, 652],
    rares: [123, 214, 272, 275, 733, 357, 45, 71, 286, 407, 182, 470],
    legendaries: [641, 642, 645],
    mythicals: [251, 493],
  },
  {
    key: 'volcano',
    name: 'Volcano',
    description: 'A blazing caldera home to fire-types, dragons, and molten legends.',
    backgroundPath: '/safari-zone/volcano.jpg',
    commons: [4, 37, 58, 77, 240, 136, 155, 218, 228, 255, 322, 324, 390, 498, 554, 636, 653, 850, 667, 725, 757, 813, 838, 909],
    uncommons: [5, 6, 38, 78, 157, 219, 229, 256, 323, 499, 500, 851, 126, 631, 514, 555, 654, 758, 776, 1004],
    rares: [59, 637, 467, 136, 668, 936],
    legendaries: [146, 250, 485, 643, 383],
    mythicals: [494, 721],
  },

  {
    key: 'ocean-shores',
    name: 'Ocean Shores',
    description: 'A bright coastal biome with oceanic Pokémon, tidal legends, and deep-sea mythicals.',
    backgroundPath: '/safari-zone/ocean-shores.png',
    commons: [7, 54, 60, 72, 79, 90, 98, 116, 118, 120, 129, 158, 140, 170, 194, 183, 223, 211, 278, 318, 320, 341, 349, 366, 393, 422, 456, 550, 592, 688, 976, 963, 964, 363, 779, 138, 686],
    uncommons: [9, 8, 55, 73, 61, 62, 91, 99, 121, 134, 160, 171, 184, 186, 222, 199, 226, 319, 363, 364, 365, 367, 368, 369, 370, 394, 418, 458, 457, 564, 693, 767, 224, 687],
    rares: [130, 342, 350, 594, 961, 395, 131],
    legendaries: [382, 484],
    mythicals: [647, 721, 489, 490],
  },

  {
    key: 'haunted-mansion',
    name: 'Haunted Mansion',
    description: 'A cursed manor crawling with ghostly whispers, lurking dark-types, and ominous lunar legends.',
    backgroundPath: '/safari-zone/haunted-mansion.png',
    commons: [92, 200, 198, 215, 228, 261, 302, 353, 355, 434, 562, 570, 607, 622, 624, 629, 679, 708, 710, 769, 827, 859, 942, 971, 425, 854, 946, 962, 559],
    uncommons: [93, 426, 229, 262, 354, 356, 435, 608, 623, 625, 680, 709, 711, 770, 860, 972, 563, 302, 359, 778, 877, 911],
    rares: [94, 609, 681, 983, 937, 430, 442, 429, 461, 571, 197],
    legendaries: [487, 717, 146, 897, 792],
    mythicals: [491, 720, 802, 488],
  },
  {
    key: 'snowy-tundra',
    name: 'Snowy Tundra',
    description: 'A frozen expanse where ice and steel Pokémon survive the cold.',
    backgroundPath: '/safari-zone/snowy-tundra.png',
    commons: [86, 87, 124, 215, 220, 225, 238, 361, 363, 393, 459, 582, 613, 712, 996, 974, 872],
    uncommons: [221, 362, 364, 460, 473, 583, 614, 615, 713, 584, 698, 875, 883, 997, 975],
    rares: [225, 365, 473, 615, 478, 699, 896, 991, 998, 873],
    legendaries: [144, 378, 646, 1002],
    mythicals: [151],
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
  if (roll < 0.40) return 'common';
  if (roll < 0.70) return 'uncommon';
  if (roll < 0.90) return 'rare';
  if (roll < 0.975) return 'legendary';
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
  if (spawn?.isShiny) return 100;
  const rarity = spawn?.safariRarity || 'common';
  const base = SAFARI_CATCH_RATES[rarity] ?? SAFARI_CATCH_RATES.common;
  return Math.min(95, base + (snackApplied ? 20 : 0));
}
