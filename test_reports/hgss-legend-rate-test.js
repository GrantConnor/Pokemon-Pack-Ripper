const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app/api/packs/open/route.js'),'utf8');
const start = src.indexOf('const LEGACY_SETS');
const end = src.indexOf('export async function POST');
let js = src.slice(start, end).replace(/^import .*$/mg, '').replace('export function openPack', 'function openPack');
const openPack = new Function(`${js}; return openPack;`)();

function makeCard(id, rarity, extras={}) {
  return { id, name:id, rarity, supertype:'Pokémon', set:{id:'hgss1',name:'HeartGold & SoulSilver', series:'HeartGold & SoulSilver'}, subtypes:[], ...extras };
}

const cards=[];
for(let i=0;i<30;i++) cards.push(makeCard(`c${i}`,'Common'));
for(let i=0;i<20;i++) cards.push(makeCard(`u${i}`,'Uncommon'));
for(let i=0;i<12;i++) cards.push(makeCard(`rh${i}`,'Rare Holo'));
for(let i=0;i<10;i++) cards.push(makeCard(`r${i}`,'Rare'));
for(let i=0;i<8;i++) cards.push(makeCard(`legend${i}`,'LEGEND'));
for(let i=0;i<4;i++) cards.push(makeCard(`sec${i}`,'Secret Rare'));

const pulls=20000;
let legendPacks=0, secretPacks=0, combinedPacks=0, duplicates=0;
for(let i=0;i<pulls;i++){
  const pack=openPack(cards,'hgss1');
  const ids=pack.map(c=>c.id);
  if(new Set(ids).size !== ids.length) duplicates++;
  const hasLegend=pack.some(c=>String(c.rarity).includes('LEGEND'));
  const hasSecret=pack.some(c=>String(c.rarity).includes('Secret Rare') || String(c.rarity).includes('Rare Secret'));
  if(hasLegend) legendPacks++;
  if(hasSecret) secretPacks++;
  if(hasLegend || hasSecret) combinedPacks++;
}
console.log(JSON.stringify({pulls, legendPacks, secretPacks, combinedPacks, combinedRate: combinedPacks / pulls, duplicates}, null, 2));
