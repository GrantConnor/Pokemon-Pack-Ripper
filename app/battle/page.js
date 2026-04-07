'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Swords } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PokemonCard({ pokemon, selected, onClick, fainted = false }) {
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all ${
        selected
          ? 'border-4 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)]'
          : fainted
            ? 'border-2 border-red-500/50 opacity-60'
            : 'border-2 border-slate-600 hover:border-cyan-500'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex gap-2 flex-wrap mb-2">
          {pokemon.isShiny && <Badge className="bg-yellow-500">✨ SHINY</Badge>}
          {pokemon.statusCondition === 'sleep' && <Badge className="bg-indigo-500">💤 Sleep</Badge>}
          {pokemon.statusCondition === 'burn' && <Badge className="bg-red-500">🔥 Burn</Badge>}
          {pokemon.statusCondition === 'poison' && <Badge className="bg-purple-500">☠ Poison</Badge>}
          {pokemon.statusCondition === 'paralysis' && <Badge className="bg-yellow-600">⚡ Paralyzed</Badge>}
          {pokemon.statusCondition === 'freeze' && <Badge className="bg-cyan-500">🧊 Frozen</Badge>}
        </div>
        <img src={pokemon.sprite} alt={pokemon.displayName} className="w-full mb-2" />
        <p className="text-white font-bold text-center">{pokemon.nickname || pokemon.displayName}</p>
        <p className="text-gray-400 text-sm text-center">Level {pokemon.level}</p>
        <p className="text-green-400 text-xs text-center">HP: {pokemon.currentHP ?? pokemon.stats.hp}/{pokemon.maxHP ?? pokemon.stats.hp}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    sleep: { label: '💤 Sleep', className: 'bg-indigo-500' },
    burn: { label: '🔥 Burn', className: 'bg-red-500' },
    poison: { label: '☠ Poison', className: 'bg-purple-500' },
    paralysis: { label: '⚡ Paralyzed', className: 'bg-yellow-600' },
    freeze: { label: '🧊 Frozen', className: 'bg-cyan-500' },
  };
  const item = map[status];
  if (!item) return null;
  return <Badge className={item.className}>{item.label}</Badge>;
}

function BattlePageContent() {
  const searchParams = useSearchParams();
  const battleId = searchParams.get('id');

  const [user, setUser] = useState(null);
  const [battle, setBattle] = useState(null);
  const [myPokemon, setMyPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      window.location.href = '/';
      return;
    }

    fetch(`/api/session?userId=${storedUserId}`)
      .then(res => res.json())
      .then(async (data) => {
        if (!data.authenticated) {
          window.location.href = '/';
          return;
        }
        setUser(data.user);
        await Promise.all([loadMyPokemon(data.user.id), loadBattle()]);
      })
      .catch(() => {
        window.location.href = '/';
      });
  }, []);

  useEffect(() => {
    if (!battleId) return;
    const interval = setInterval(() => {
      loadBattle();
    }, 2000);
    return () => clearInterval(interval);
  }, [battleId]);

  const loadMyPokemon = async (userId) => {
    try {
      const response = await fetch(`/api/wilds/my-pokemon?userId=${userId}`);
      const data = await response.json();
      setMyPokemon((data.pokemon || []).filter((pokemon) => pokemon && (pokemon._id || pokemon.id)));
    } catch (err) {
      console.error('Error loading Pokemon:', err);
    }
  };

  const loadBattle = async () => {
    if (!battleId) return;
    try {
      const response = await fetch('/api/battles/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId })
      });
      const data = await response.json();
      if (data.battle) setBattle(data.battle);
    } catch (err) {
      console.error('Error loading battle:', err);
    }
  };

  const filteredPokemon = useMemo(() => {
    const term = teamSearch.trim().toLowerCase();
    if (!term) return myPokemon;
    return myPokemon.filter((pokemon) => {
      const name = (pokemon.nickname || pokemon.displayName || '').toLowerCase();
      return name.includes(term) || String(pokemon.id || '').includes(term);
    });
  }, [myPokemon, teamSearch]);

  if (!user || !battle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <p className="text-white text-xl">Loading battle...</p>
      </div>
    );
  }

  const isPlayer1 = battle.player1.userId === user.id;
  const myPlayerKey = isPlayer1 ? 'player1' : 'player2';
  const opponentPlayerKey = isPlayer1 ? 'player2' : 'player1';
  const myPlayer = battle[myPlayerKey];
  const opponentPlayer = battle[opponentPlayerKey];
  const myCurrentPokemon = myPlayer.pokemon?.[myPlayer.currentPokemonIndex];
  const opponentCurrentPokemon = opponentPlayer.pokemon?.[opponentPlayer.currentPokemonIndex];
  const awaitingMySwitch = battle.awaitingSwitchFor === user.id;
  const myMoveLocked = !!battle.pendingActions?.[myPlayerKey];
  const opponentMoveLocked = !!battle.pendingActions?.[opponentPlayerKey];
  const battleLog = [...(battle.battleLog || [])].reverse();

  const handleSelectPokemon = (pokemon) => {
    if (selectedPokemon.find(p => p._id === pokemon._id)) {
      setSelectedPokemon(selectedPokemon.filter(p => p._id !== pokemon._id));
    } else if (selectedPokemon.length < 6) {
      setSelectedPokemon([...selectedPokemon, pokemon]);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedPokemon.length === 0) {
      alert('Please select at least 1 Pokemon');
      return;
    }
    try {
      const response = await fetch('/api/battles/select-pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
          userId: user.id,
          pokemonIds: selectedPokemon.map(p => p._id.toString())
        })
      });
      const data = await response.json();
      if (data.success) {
        await loadBattle();
      } else {
        alert(data.error || 'Error selecting Pokemon');
      }
    } catch {
      alert('Error selecting Pokemon');
    }
  };

  const handleAttack = async (moveIndex) => {
    if (actionSubmitting) return;
    setActionSubmitting(true);
    try {
      const response = await fetch('/api/battles/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, userId: user.id, moveIndex })
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Error using move');
      }
      await loadBattle();
    } catch {
      alert('Error using move');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleSwitchPokemon = async (pokemonIndex) => {
    if (actionSubmitting) return;
    setActionSubmitting(true);
    try {
      const response = await fetch('/api/battles/switch-pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, userId: user.id, pokemonIndex })
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Error switching Pokemon');
      }
      await loadBattle();
    } catch {
      alert('Error switching Pokemon');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleForfeit = async () => {
    if (!confirm('Are you sure you want to forfeit?')) return;
    try {
      const response = await fetch('/api/battles/forfeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId, userId: user.id })
      });
      const data = await response.json();
      if (data.success) {
        alert('you forfeit');
        window.location.href = '/wilds';
      }
    } catch {
      alert('Error forfeiting');
    }
  };

  if (battle.status === 'selecting' && !myPlayer.ready) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/wilds">
              <Button variant="outline" className="bg-slate-800 border-cyan-500">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pokemon Wilds
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">Select Your Battle Team</h1>
          </div>

          <Card className="border-2 border-cyan-500/50 bg-slate-800/90 mb-6">
            <CardContent className="pt-6 space-y-4">
              <p className="text-white text-center">Choose up to 6 Pokemon for battle ({selectedPokemon.length}/6)</p>
              <Input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search your Pokemon by name or number..."
                className="bg-slate-900 border-cyan-500 text-white"
              />
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedPokemon.length === 0}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600"
              >
                Confirm Team ({selectedPokemon.length})
              </Button>
            </CardContent>
          </Card>

          <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPokemon.map((pokemon) => (
                <PokemonCard
                  key={pokemon._id}
                  pokemon={pokemon}
                  selected={!!selectedPokemon.find(p => p._id === pokemon._id)}
                  onClick={() => handleSelectPokemon(pokemon)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  if (battle.status === 'selecting' && myPlayer.ready && !opponentPlayer.ready) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <Link href="/wilds">
            <Button variant="outline" className="bg-slate-800 border-cyan-500">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pokemon Wilds
            </Button>
          </Link>
          <div className="animate-spin text-6xl">⚔️</div>
          <p className="text-white text-2xl">Waiting for {opponentPlayer.username} to lock in their team...</p>
        </div>
      </div>
    );
  }

  if (battle.status === 'active' || battle.status === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-emerald-800 to-green-900 p-4 md:p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 text-6xl">🌿</div>
          <div className="absolute top-40 right-20 text-6xl">🍃</div>
          <div className="absolute bottom-20 left-40 text-6xl">🌲</div>
          <div className="absolute bottom-40 right-10 text-6xl">🌳</div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <Link href="/wilds">
              <Button variant="outline" className="bg-slate-800 border-green-500">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pokemon Wilds
              </Button>
            </Link>
            <div className="text-center flex-1 min-w-[240px]">
              <h1 className="text-2xl font-bold text-white mb-1">Battle Arena</h1>
              <p className="text-green-300">
                {battle.status === 'finished'
                  ? `Winner: ${battle.winner === user.id ? 'You!' : opponentPlayer.username}`
                  : awaitingMySwitch
                    ? 'Choose your next Pokemon'
                    : myMoveLocked
                      ? opponentMoveLocked ? 'Resolving round...' : 'Move locked in — waiting for opponent'
                      : 'Choose your move'}
              </p>
            </div>
            <Button onClick={handleForfeit} disabled={battle.status === 'finished'} className="bg-red-600 hover:bg-red-500">
              Flee
            </Button>
          </div>

          {battle.status === 'active' && !awaitingMySwitch && (
            <Card className="border-2 border-green-500/50 bg-slate-800/90">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xl font-bold text-white">Attack</h2>
                  <p className="text-sm text-yellow-300">
                    {myMoveLocked ? 'Your move is locked in.' : 'Pick a move for this round.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCurrentPokemon?.moveset?.map((move, index) => {
                    const moveData = myCurrentPokemon.allMovesData?.find(m => m.name === move);
                    return (
                      <Button
                        key={index}
                        onClick={() => handleAttack(index)}
                        disabled={myMoveLocked || actionSubmitting || myCurrentPokemon.currentHP === 0 || battle.status !== 'active'}
                        className="h-20 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 flex flex-col items-center justify-center"
                      >
                        <span className="font-bold">{move.replace(/-/g, ' ').toUpperCase()}</span>
                        {moveData && (
                          <span className="text-xs text-center">
                            {moveData.type} • {moveData.damageClass} • Power: {moveData.power || 'N/A'}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-white font-bold mb-2">{opponentPlayer.username}'s {opponentCurrentPokemon?.displayName}</p>
                <div className="flex justify-center mb-2"><StatusBadge status={opponentCurrentPokemon?.statusCondition} /></div>
                <div className="flex justify-center mb-2">
                  <div className="w-64">
                    <div className="bg-slate-800/80 rounded-full h-4 overflow-hidden border-2 border-white">
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${((opponentCurrentPokemon?.currentHP || 0) / Math.max(1, opponentCurrentPokemon?.maxHP || 1)) * 100}%` }} />
                    </div>
                    <p className="text-white text-sm mt-1">HP: {opponentCurrentPokemon?.currentHP}/{opponentCurrentPokemon?.maxHP}</p>
                  </div>
                </div>
                {opponentCurrentPokemon && <img src={opponentCurrentPokemon.sprite} alt={opponentCurrentPokemon.displayName} className="w-40 h-40 md:w-48 md:h-48 mx-auto" />}
                <p className="text-gray-300">Level {opponentCurrentPokemon?.level}</p>
              </div>

              <div className="text-center">
                <Swords className="w-12 h-12 text-white mx-auto" />
              </div>

              <div className="text-center">
                <p className="text-white font-bold mb-2">Your {myCurrentPokemon?.displayName}</p>
                <div className="flex justify-center mb-2"><StatusBadge status={myCurrentPokemon?.statusCondition} /></div>
                {myCurrentPokemon && <img src={myCurrentPokemon.sprite} alt={myCurrentPokemon.displayName} className="w-40 h-40 md:w-48 md:h-48 mx-auto mb-2" />}
                <div className="flex justify-center mb-2">
                  <div className="w-64">
                    <div className="bg-slate-800/80 rounded-full h-4 overflow-hidden border-2 border-white">
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${((myCurrentPokemon?.currentHP || 0) / Math.max(1, myCurrentPokemon?.maxHP || 1)) * 100}%` }} />
                    </div>
                    <p className="text-white text-sm mt-1">HP: {myCurrentPokemon?.currentHP}/{myCurrentPokemon?.maxHP}</p>
                  </div>
                </div>
                <p className="text-gray-300">Level {myCurrentPokemon?.level}</p>
              </div>

              {battle.status === 'active' && awaitingMySwitch && (
                <Card className="border-2 border-yellow-500/50 bg-slate-800/90">
                  <CardContent className="p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white">Choose Your Next Pokemon</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {myPlayer.pokemon
                        ?.map((pokemon, index) => ({ pokemon, index }))
                        .filter(({ pokemon, index }) => pokemon.currentHP > 0 && index !== myPlayer.currentPokemonIndex)
                        .map(({ pokemon, index }) => (
                          <PokemonCard
                            key={`${pokemon._id || pokemon.id}-${index}`}
                            pokemon={pokemon}
                            onClick={() => handleSwitchPokemon(index)}
                          />
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {battle.status === 'finished' && (
                <div className="text-center">
                  <Card className="border-4 border-yellow-500 bg-slate-800/90">
                    <CardContent className="p-8">
                      <p className="text-4xl font-bold text-white mb-4">
                        {battle.winner === user.id ? '🎉 Victory!' : '💀 Defeat!'}
                      </p>
                      <Link href="/wilds">
                        <Button className="bg-cyan-600 hover:bg-cyan-500">Return to Wilds</Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <Card className="border-2 border-slate-600 bg-slate-900/85 h-fit sticky top-4">
              <CardContent className="p-4">
                <h2 className="text-white font-bold mb-3">Battle Log</h2>
                <ScrollArea className="h-[420px] pr-4">
                  <div className="space-y-3">
                    {battleLog.length === 0 && <p className="text-slate-400 text-sm">The battle is about to begin.</p>}
                    {battleLog.map((entry, index) => (
                      <div key={`${entry.timestamp}-${index}`} className="rounded-lg bg-slate-800/80 p-3 text-sm text-white">
                        {entry.message || `${entry.attacker || entry.player} used a move.`}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function BattlePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center text-white">Loading battle...</div>}>
      <BattlePageContent />
    </Suspense>
  );
}
