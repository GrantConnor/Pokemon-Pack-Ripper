import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongodb';
import axios from 'axios';
import { fetchPokemonData, calculateStats } from '@/lib/wilds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

async function fetchEvolutionChain(pokemonId) {
  try {
    const speciesResponse = await axios.get(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`);
    const evolutionChainUrl = speciesResponse.data.evolution_chain.url;
    const chainResponse = await axios.get(evolutionChainUrl);
    const chain = chainResponse.data.chain;

    function findEvolution(node, currentId) {
      if (node.species.url.includes(`/${currentId}/`)) {
        if (node.evolves_to && node.evolves_to.length > 0) {
          const nextEvolution = node.evolves_to[0];
          const evolutionDetails = nextEvolution.evolution_details?.[0] || {};
          const urlParts = nextEvolution.species.url.split('/');
          const nextId = parseInt(urlParts[urlParts.length - 2], 10);
          return {
            canEvolve: true,
            evolvesTo: nextId,
            trigger: evolutionDetails.trigger?.name || null,
            itemName: evolutionDetails.item?.name || evolutionDetails.held_item?.name || null,
          };
        }
        return { canEvolve: false };
      }
      for (const evolution of node.evolves_to || []) {
        const result = findEvolution(evolution, currentId);
        if (result) return result;
      }
      return null;
    }

    return findEvolution(chain, pokemonId) || { canEvolve: false };
  } catch {
    return { canEvolve: false };
  }
}

async function applyEvolutionToStoredPokemon(database, pokemon, evolutionData) {
  const evolvedData = await fetchPokemonData(evolutionData.evolvesTo, pokemon.isShiny);
  const updateData = {
    id: evolvedData.id,
    name: evolvedData.name,
    displayName: evolvedData.displayName,
    sprite: evolvedData.sprite,
    types: evolvedData.types,
    baseStats: evolvedData.baseStats,
    allMoves: evolvedData.allMoves,
    allMovesData: evolvedData.allMovesData,
    captureRate: evolvedData.captureRate,
    isLegendary: evolvedData.isLegendary,
    isMythical: evolvedData.isMythical,
    stats: calculateStats(evolvedData.baseStats, pokemon.ivs, pokemon.level),
    moveset: evolvedData.moveset,
  };

  await database.collection('caught_pokemon').updateOne(
    { _id: pokemon._id },
    { $set: updateData }
  );

  return evolvedData;
}

async function autoEvolveTradePokemon(database, pokemon) {
  const evolutionData = await fetchEvolutionChain(pokemon.id);
  if (!evolutionData?.canEvolve) return null;
  if (evolutionData.trigger !== 'trade') return null;
  if (evolutionData.itemName) return null;
  return applyEvolutionToStoredPokemon(database, pokemon, evolutionData);
}


export async function POST(request) {
  try {
    const { userId, tradeId } = await request.json();
    if (!userId || !tradeId) {
      return NextResponse.json({ error: 'User ID and Trade ID required' }, { status: 400 });
    }

    const database = await connectDB();
    const users = database.collection('users');
    const user = await users.findOne({ id: userId }, { projection: { id: 1, username: 1, tradeRequests: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tradeRequest = user.tradeRequests?.find(t => t.id === tradeId);
    if (!tradeRequest) {
      return NextResponse.json({ error: 'Trade request not found' }, { status: 404 });
    }

    const fromPokemonId = tradeRequest.offeredPokemon?.[0]?.pokemonId;
    const toPokemonId = tradeRequest.requestedPokemon?.[0]?.pokemonId;
    if (!fromPokemonId || !toPokemonId) {
      return NextResponse.json({ error: 'Invalid Pokémon trade payload' }, { status: 400 });
    }

    const caught = database.collection('caught_pokemon');
    const [fromPokemon, toPokemon] = await Promise.all([
      caught.findOne({ _id: new ObjectId(fromPokemonId), userId: tradeRequest.fromId }),
      caught.findOne({ _id: new ObjectId(toPokemonId), userId }),
    ]);

    if (!fromPokemon || !toPokemon) {
      return NextResponse.json({ error: 'One or both Pokémon not found' }, { status: 404 });
    }

    await Promise.all([
      caught.updateOne({ _id: fromPokemon._id }, { $set: { userId } }),
      caught.updateOne({ _id: toPokemon._id }, { $set: { userId: tradeRequest.fromId } }),
      users.updateOne({ id: userId }, { $pull: { tradeRequests: { id: tradeId } }, $inc: { tradesCompleted: 1 } }),
      users.updateOne({ id: tradeRequest.fromId }, { $inc: { tradesCompleted: 1 } }),
    ]);

    const autoEvolvedReceived = await autoEvolveTradePokemon(database, fromPokemon);
    const autoEvolvedSent = await autoEvolveTradePokemon(database, toPokemon);

    return NextResponse.json({
      success: true,
      message: `Trade completed! You received ${autoEvolvedReceived?.displayName || fromPokemon.displayName}`,
      receivedPokemon: autoEvolvedReceived?.displayName || fromPokemon.displayName,
      sentPokemon: autoEvolvedSent?.displayName || toPokemon.displayName,
      autoEvolved: [autoEvolvedReceived?.displayName, autoEvolvedSent?.displayName].filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to accept Pokémon trade' }, { status: 500 });
  }
}
