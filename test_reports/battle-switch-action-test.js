function getEffectiveStat(pokemon, statKey) {
  return pokemon.stats?.[statKey] || 1;
}

function getActionPriority(action, pokemon) {
  if (action.type === 'switch') return 999;
  const moveName = pokemon.moveset?.[action.moveIndex];
  const move = pokemon.allMovesData?.find((m) => m.name === moveName);
  return move?.priority || 0;
}

function resolveOrder(state, pendingActions) {
  return ['player1', 'player2'].sort((a, b) => {
    const pokemonA = state[a].pokemon[state[a].currentPokemonIndex];
    const pokemonB = state[b].pokemon[state[b].currentPokemonIndex];
    const priorityA = getActionPriority(pendingActions[a], pokemonA);
    const priorityB = getActionPriority(pendingActions[b], pokemonB);
    if (priorityA !== priorityB) return priorityB - priorityA;
    return getEffectiveStat(pokemonB, 'speed') - getEffectiveStat(pokemonA, 'speed');
  });
}

function runScenario() {
  const state = {
    player1: {
      userId: 'u1',
      currentPokemonIndex: 0,
      pokemon: [
        { displayName: 'Bulbasaur', currentHP: 100, maxHP: 100, stats: { speed: 45 }, moveset: ['growl'], allMovesData: [{ name: 'growl', priority: 0 }] },
        { displayName: 'Charmeleon', currentHP: 120, maxHP: 120, stats: { speed: 80 }, moveset: ['scratch'], allMovesData: [{ name: 'scratch', priority: 0, power: 40 }] },
      ],
    },
    player2: {
      userId: 'u2',
      currentPokemonIndex: 0,
      pokemon: [
        { displayName: 'Wartortle', currentHP: 150, maxHP: 150, stats: { speed: 50 }, moveset: ['water-gun'], allMovesData: [{ name: 'water-gun', priority: 0, power: 40 }] },
      ],
    },
  };

  const pendingActions = {
    player1: { type: 'switch', pokemonIndex: 1 },
    player2: { type: 'attack', moveIndex: 0 },
  };

  const order = resolveOrder(state, pendingActions);
  const log = [];

  for (const actingKey of order) {
    const defendingKey = actingKey === 'player1' ? 'player2' : 'player1';
    const action = pendingActions[actingKey];
    if (action.type === 'switch') {
      state[actingKey].currentPokemonIndex = action.pokemonIndex;
      log.push(`${actingKey} switched to ${state[actingKey].pokemon[action.pokemonIndex].displayName}`);
      continue;
    }
    const defendingPokemon = state[defendingKey].pokemon[state[defendingKey].currentPokemonIndex];
    defendingPokemon.currentHP -= 30;
    log.push(`${actingKey} attacked ${defendingPokemon.displayName}`);
  }

  return {
    order,
    log,
    activeAfterSwitch: state.player1.pokemon[state.player1.currentPokemonIndex].displayName,
    hpAfterAttack: state.player1.pokemon[state.player1.currentPokemonIndex].currentHP,
    originalLeadHp: state.player1.pokemon[0].currentHP,
  };
}

const result = runScenario();
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    switchResolvedFirst: result.order[0] === 'player1',
    newPokemonBecameActive: result.activeAfterSwitch === 'Charmeleon',
    newPokemonTookDamage: result.hpAfterAttack === 90,
    originalPokemonUntouched: result.originalLeadHp === 100,
  },
  details: result,
};
console.log(JSON.stringify(report, null, 2));
