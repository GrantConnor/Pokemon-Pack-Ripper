import { buildSetTitles, evaluateSetCompletion, getActiveDisplayTitle } from '../lib/set-titles.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const titles = buildSetTitles('base1', 'Base Set');
assert(titles.length === 2, 'expected 2 titles');

const allCards = [
  { id: 'a', number: '1', set: { id: 'base1', printedTotal: 2 } },
  { id: 'b', number: '2', set: { id: 'base1', printedTotal: 2 } },
  { id: 'c', number: '101', set: { id: 'base1', printedTotal: 2 } },
];
const fullOnly = evaluateSetCompletion([allCards[0], allCards[1]], allCards, 'base1');
assert(fullOnly.fullSetCompleted === true, 'full set should be completed');
assert(fullOnly.masterSetCompleted === false, 'master set should not be completed');

const master = evaluateSetCompletion(allCards, allCards, 'base1');
assert(master.masterSetCompleted === true, 'master set should be completed');

const display = getActiveDisplayTitle({ battleWins: 12, unlockedTitles: titles, selectedTitleId: titles[0].id });
assert(display.id === titles[0].id, 'selected title should override battle rank');

console.log(JSON.stringify({ ok: true, titles: titles.map(t => t.label), fullOnly, master, display }, null, 2));
