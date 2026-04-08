export const BREAKDOWN_VALUES = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 10,
  'Rare Holo': 10,
  'Rare Shiny': 20,
  'Radiant Rare': 25,
  'Amazing Rare': 35,
  'Rare Prism Star': 35,
  'ACE SPEC Rare': 40,
  'Rare BREAK': 50,
  'Double Rare': 50,
  'Rare Holo EX': 50,
  'Illustration Rare': 75,
  'Ultra Rare': 75,
  'Rare Ultra': 75,
  'Special Illustration Rare': 100,
  'Rare Holo V': 100,
  'Rare Holo VMAX': 100,
  'Shiny Rare': 100,
  'LEGEND': 10,
  'Rare Rainbow': 175,
  'Hyper Rare': 200,
  'Rare Secret': 200,
  'Secret Rare': 200,
};

export function getBreakdownValueForRarity(rarity) {
  return BREAKDOWN_VALUES[rarity] || 10;
}
