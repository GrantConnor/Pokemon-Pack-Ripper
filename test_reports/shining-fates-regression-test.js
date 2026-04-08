const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app/api/packs/open/route.js'),'utf8');
const start = src.indexOf('const LEGACY_SETS');
const end = src.indexOf('export async function POST');
let js = src.slice(start, end).replace(/^import .*$/mg, '').replace('export function openPack', 'function openPack');
const openPack = new Function(`${js}; return openPack;`)();

function makeCard(id, rarity, extras = {}) {
  return { id, name: id, rarity, supertype: 'Pokémon', set: { id: 'swsh45', name: 'Shining Fates' }, subtypes: [], ...extras };
}

const cards = [];
for (let i = 0; i < 30; i++) cards.push(makeCard(`c${i}`, 'Common'));
for (let i = 0; i < 20; i++) cards.push(makeCard(`u${i}`, 'Uncommon'));
for (let i = 0; i < 10; i++) cards.push(makeCard(`r${i}`, 'Rare'));
for (let i = 0; i < 8; i++) cards.push(makeCard(`rh${i}`, 'Rare Holo'));
for (let i = 0; i < 20; i++) cards.push(makeCard(`sv${i}`, 'Rare Shiny', { set: { id: 'swsh45sv', name: 'Shiny Vault' } }));
for (let i = 0; i < 12; i++) cards.push(makeCard(`v${i}`, 'Rare Holo V', { set: { id: 'swsh45sv', name: 'Shiny Vault' }, subtypes: ['V'] }));
for (let i = 0; i < 12; i++) cards.push(makeCard(`vm${i}`, 'Rare Holo VMAX', { set: { id: 'swsh45sv', name: 'Shiny Vault' }, subtypes: ['VMAX'] }));
for (let i = 0; i < 6; i++) cards.push(makeCard(`ff${i}`, 'Shiny Rare', { set: { id: 'swsh45sv', name: 'Shiny Vault' }, subtypes: ['V'] }));

const pulls = 20000;
let rareShiny = 0;
let rareHoloV = 0;
let rareHoloVMAX = 0;
let duplicates = 0;

for (let i = 0; i < pulls; i++) {
  const pack = openPack(cards, 'swsh45');
  if (pack.length !== 10) throw new Error(`Expected 10 cards, got ${pack.length}`);
  if (new Set(pack.map(card => card.id)).size !== pack.length) duplicates++;
  if (pack.some(card => card.rarity === 'Rare Shiny')) rareShiny++;
  if (pack.some(card => card.rarity === 'Rare Holo V')) rareHoloV++;
  if (pack.some(card => card.rarity === 'Rare Holo VMAX')) rareHoloVMAX++;
}

const report = { pulls, rareShiny, rareHoloV, rareHoloVMAX, duplicates };
console.log(JSON.stringify(report, null, 2));
