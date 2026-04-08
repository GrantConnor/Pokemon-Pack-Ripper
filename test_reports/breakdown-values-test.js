const fs = require('fs');
const path = require('path');
const assert = require('assert');

const breakdownSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'breakdown-values.js'), 'utf8');
const js = breakdownSrc.replace(/export\s+/g, '');
const api = new Function(`${js}; return { BREAKDOWN_VALUES, getBreakdownValueForRarity };`)();
const { BREAKDOWN_VALUES, getBreakdownValueForRarity } = api;

assert.equal(getBreakdownValueForRarity('Common'), 1);
assert.equal(getBreakdownValueForRarity('Uncommon'), 2);
assert.equal(getBreakdownValueForRarity('Rare'), 10);
assert.equal(getBreakdownValueForRarity('Double Rare'), 50);
assert.equal(getBreakdownValueForRarity('Illustration Rare'), 75);
assert.equal(getBreakdownValueForRarity('Ultra Rare'), 75);
assert.equal(getBreakdownValueForRarity('Special Illustration Rare'), 100);
assert.equal(getBreakdownValueForRarity('Hyper Rare'), 200);
assert.equal(getBreakdownValueForRarity('Secret Rare'), 200);
assert.equal(getBreakdownValueForRarity('Rare Holo V'), 100);
assert.equal(getBreakdownValueForRarity('Rare Holo VMAX'), 100);
assert.equal(getBreakdownValueForRarity('Rare Shiny'), 20);
assert.equal(getBreakdownValueForRarity('Unknown Rarity'), 10);

const expectedRarities = [
  'Common','Uncommon','Rare','Rare Holo','Rare Holo EX','Rare Holo V','Rare Holo VMAX',
  'Double Rare','Illustration Rare','Special Illustration Rare','Ultra Rare','Rare Ultra',
  'Rare Rainbow','Hyper Rare','Secret Rare','Rare Secret','Amazing Rare','Rare BREAK',
  'Rare Prism Star','ACE SPEC Rare','Rare Shiny','Shiny Rare','Radiant Rare','LEGEND'
];

const missing = expectedRarities.filter(r => !(r in BREAKDOWN_VALUES));
assert.equal(missing.length, 0, `Missing breakdown values for: ${missing.join(', ')}`);

console.log(JSON.stringify({
  status: 'passed',
  values: BREAKDOWN_VALUES,
  checkedCount: expectedRarities.length,
}, null, 2));
