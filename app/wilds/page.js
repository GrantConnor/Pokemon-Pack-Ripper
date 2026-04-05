'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';

export default function PokemonWilds() {
  const [user, setUser] = useState(null);
  const [spawn, setSpawn] = useState(null);
  const [showCatchDialog, setShowCatchDialog] = useState(false);
  const [catchResult, setCatchResult] = useState(null);
  const [catching, setCatching] = useState(false);
  const [myPokemon, setMyPokemon] = useState([]);
  const [showMyPokemon, setShowMyPokemon] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [timeUntilSpawn, setTimeUntilSpawn] = useState(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [editingMoveset, setEditingMoveset] = useState(false);
  const [selectedMoves, setSelectedMoves] = useState([]);
  const [availableMoves, setAvailableMoves] = useState([]);

  useEffect(() => {
    // Check if user is logged in
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      fetch(`/api/session?userId=${storedUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setUser(data.user);
            loadCurrentSpawn();
            loadMyPokemon();
          } else {
            localStorage.removeItem('userId');
            window.location.href = '/';
          }
        });
    } else {
      window.location.href = '/';
    }
  }, []);

  // Poll for new spawns every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      loadCurrentSpawn();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Countdown timer for next spawn
  useEffect(() => {
    if (!timeUntilSpawn) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = timeUntilSpawn - now;
      
      if (remaining <= 0) {
        setTimeUntilSpawn(null);
        loadCurrentSpawn();
      } else {
        setTimeUntilSpawn(timeUntilSpawn);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeUntilSpawn]);

  const loadCurrentSpawn = async () => {
    try {
      const response = await fetch('/api/wilds/current');
      const data = await response.json();
      
      if (data.spawn) {
        setSpawn(data.spawn);
        setTimeUntilSpawn(null);
        
        // Show notification if new Pokemon
        if (!spawn || spawn.pokemon.id !== data.spawn.pokemon.id) {
          showSpawnNotification(data.spawn.pokemon);
        }
      } else if (data.nextSpawnTime) {
        setSpawn(null);
        setTimeUntilSpawn(data.nextSpawnTime);
      }
    } catch (err) {
      console.error('Error loading spawn:', err);
    }
  };

  const loadMyPokemon = async () => {
    try {
      const response = await fetch(`/api/wilds/my-pokemon?userId=${user.id}`);
      const data = await response.json();
      setMyPokemon(data.pokemon || []);
    } catch (err) {
      console.error('Error loading Pokemon:', err);
    }
  };

  const showSpawnNotification = (pokemon) => {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pokemon Wilds', {
        body: `A wild ${pokemon.displayName} has spawned in the wilds!`,
        icon: pokemon.sprite
      });
    }
  };

  const handleCatchAttempt = async () => {
    if (!user || !spawn) return;

    setCatching(true);
    try {
      const response = await fetch('/api/wilds/catch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();
      setCatchResult(data);

      if (data.caught) {
        // Success!
        setTimeout(() => {
          setShowCatchDialog(false);
          setCatchResult(null);
          loadMyPokemon();
          loadCurrentSpawn();
        }, 3000);
      } else if (data.fled) {
        // Pokemon fled
        setTimeout(() => {
          setShowCatchDialog(false);
          setCatchResult(null);
        }, 3000);
      }
    } catch (err) {
      alert('Error attempting catch');
    } finally {
      setCatching(false);
    }
  };

  const handleAdminSpawn = async () => {
    if (!user || user.username !== 'Spheal') return;
    
    try {
      const response = await fetch('/api/wilds/admin-spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id })
      });

      const data = await response.json();
      if (data.success) {
        loadCurrentSpawn();
        alert(data.message);
      }
    } catch (err) {
      alert('Error spawning Pokemon');
    }
  };

  const handleUpdateNickname = async () => {
    if (!selectedPokemon) return;

    try {
      const response = await fetch('/api/wilds/update-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: selectedPokemon._id,
          nickname: newNickname.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedPokemon({ ...selectedPokemon, nickname: newNickname.trim() });
        setEditingNickname(false);
        loadMyPokemon();
      }
    } catch (err) {
      alert('Error updating nickname');
    }
  };

  const handleUpdateMoveset = async () => {
    if (!selectedPokemon || selectedMoves.length !== 4) {
      alert('Please select exactly 4 moves');
      return;
    }

    try {
      const response = await fetch('/api/wilds/update-moveset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: selectedPokemon._id,
          moveset: selectedMoves
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedPokemon({ ...selectedPokemon, moveset: selectedMoves });
        setEditingMoveset(false);
        loadMyPokemon();
      } else {
        alert(data.error || 'Error updating moveset');
      }
    } catch (err) {
      alert('Error updating moveset');
    }
  };

  const toggleMoveSelection = (move) => {
    if (selectedMoves.includes(move)) {
      setSelectedMoves(selectedMoves.filter(m => m !== move));
    } else if (selectedMoves.length < 4) {
      setSelectedMoves([...selectedMoves, move]);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '...';
    const totalSeconds = Math.floor((ms - Date.now()) / 1000);
    if (totalSeconds <= 0) return 'Soon...';
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTypeColor = (type) => {
    const colors = {
      normal: 'bg-gray-400', fire: 'bg-red-500', water: 'bg-blue-500',
      electric: 'bg-yellow-400', grass: 'bg-green-500', ice: 'bg-cyan-300',
      fighting: 'bg-red-700', poison: 'bg-purple-500', ground: 'bg-yellow-600',
      flying: 'bg-indigo-400', psychic: 'bg-pink-500', bug: 'bg-lime-500',
      rock: 'bg-yellow-700', ghost: 'bg-purple-700', dragon: 'bg-indigo-600',
      dark: 'bg-gray-700', steel: 'bg-gray-400', fairy: 'bg-pink-300'
    };
    return colors[type] || 'bg-gray-500';
  };

  if (!user) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-white">Loading...</p>
    </div>;
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(https://customer-assets.emergentagent.com/job_booster-hub-1/artifacts/3j79tqa6_image.png)' }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900/90 to-slate-800/90 border-b-4 border-cyan-500 p-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button className="bg-cyan-600 hover:bg-cyan-500">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Pack Ripper
                </Button>
              </Link>
              <div>
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  Pokemon Wilds
                </h1>
                <p className="text-cyan-200">Catch wild Pokemon as they appear!</p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              {user.username === 'Spheal' && (
                <Button 
                  onClick={handleAdminSpawn}
                  className="bg-red-600 hover:bg-red-500 border-2 border-red-400 font-bold"
                >
                  ⚡ Spawn Pokemon Now
                </Button>
              )}
              <Button 
                onClick={() => {
                  setShowMyPokemon(true);
                  loadMyPokemon();
                }}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                My Pokemon ({myPokemon.length})
              </Button>
              <div className="text-right">
                <p className="text-sm text-gray-400">Trainer</p>
                <p className="text-xl font-bold text-white">{user.username}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="max-w-7xl mx-auto p-8 mt-12">
          {spawn && spawn.pokemon ? (
            <div className="text-center">
              {/* Pokemon Display */}
              <div className="mb-8 animate-bounce-slow">
                <img
                  src={spawn.pokemon.sprite}
                  alt={spawn.pokemon.displayName}
                  className="w-64 h-64 mx-auto drop-shadow-2xl filter brightness-110"
                  style={{
                    filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.7))'
                  }}
                />
              </div>

              {/* Pokemon Info */}
              <Card className="bg-slate-900/90 border-cyan-500/50 border-2 max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-3xl text-cyan-400 flex items-center justify-center gap-2">
                    {spawn.pokemon.displayName}
                    <span className="text-gray-400 text-lg">#{spawn.pokemon.id}</span>
                    {spawn.pokemon.gender && spawn.pokemon.gender !== 'genderless' && (
                      <span className="text-2xl">
                        {spawn.pokemon.gender === 'male' ? '♂️' : '♀️'}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 justify-center">
                    {spawn.pokemon.types.map(type => (
                      <Badge 
                        key={type} 
                        className={`${getTypeColor(type)} text-white font-bold capitalize px-4 py-1`}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>

                  {(spawn.pokemon.isLegendary || spawn.pokemon.isMythical) && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold">
                      {spawn.pokemon.isLegendary ? '⭐ Legendary' : '✨ Mythical'}
                    </Badge>
                  )}

                  <Button
                    onClick={() => setShowCatchDialog(true)}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xl py-6"
                    disabled={catching}
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Attempt to Catch
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center">
              <Card className="bg-slate-900/90 border-cyan-500/50 border-2 max-w-md mx-auto">
                <CardContent className="py-12">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-cyan-400 animate-pulse" />
                  <h2 className="text-2xl font-bold text-white mb-2">No Pokemon Currently</h2>
                  <p className="text-gray-400">The wilds are quiet... check back soon!</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Catch Attempt Dialog */}
      <Dialog open={showCatchDialog} onOpenChange={setShowCatchDialog}>
        <DialogContent className="max-w-md border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400">
              Catching {spawn?.pokemon?.displayName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!catchResult ? (
              <>
                <img
                  src={spawn?.pokemon?.sprite}
                  alt={spawn?.pokemon?.displayName}
                  className="w-32 h-32 mx-auto"
                />
                <p className="text-center text-gray-300">
                  Throw a Pokeball and hope for the best!
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowCatchDialog(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500"
                    disabled={catching}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCatchAttempt}
                    className="flex-1 bg-red-600 hover:bg-red-500 font-bold"
                    disabled={catching}
                  >
                    {catching ? 'Throwing...' : 'Throw Pokeball!'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                {catchResult.caught ? (
                  <div className="space-y-4">
                    <div className="text-6xl animate-bounce">🎉</div>
                    <h3 className="text-2xl font-bold text-green-400">
                      {catchResult.message}
                    </h3>
                    <p className="text-gray-300">Added to My Pokemon!</p>
                  </div>
                ) : catchResult.fled ? (
                  <div className="space-y-4">
                    <div className="text-6xl">😢</div>
                    <h3 className="text-2xl font-bold text-red-400">
                      {catchResult.message}
                    </h3>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-6xl">💨</div>
                    <h3 className="text-2xl font-bold text-yellow-400">
                      {catchResult.message}
                    </h3>
                    <p className="text-gray-300">
                      Attempts remaining: {catchResult.attemptsRemaining}
                    </p>
                    <p className="text-sm text-gray-400">
                      Catch chance: ~{catchResult.catchChance}%
                    </p>
                    <Button
                      onClick={() => setCatchResult(null)}
                      className="bg-red-600 hover:bg-red-500"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* My Pokemon Dialog */}
      <Dialog open={showMyPokemon} onOpenChange={setShowMyPokemon}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-4 border-purple-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-purple-400">
              My Pokemon Collection ({myPokemon.length})
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[70vh] pr-4">
            {myPokemon.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No Pokemon caught yet!</p>
                <p className="text-gray-500">Visit the wilds to catch some Pokemon.</p>
              </div>
            ) : (
              myPokemon.map((pokemon, idx) => (
                <Card 
                  key={idx}
                  className="bg-slate-800/90 border-purple-500/30 cursor-pointer hover:border-purple-500 transition-all"
                  onClick={() => setSelectedPokemon(pokemon)}
                >
                  <CardContent className="p-4">
                    <img
                      src={pokemon.sprite}
                      alt={pokemon.displayName}
                      className="w-24 h-24 mx-auto mb-2"
                    />
                    <h3 className="text-center font-bold text-white">
                      {pokemon.displayName}
                    </h3>
                    <p className="text-center text-gray-400 text-sm">
                      #{pokemon.id}
                    </p>
                    <div className="flex gap-1 justify-center mt-2 flex-wrap">
                      {pokemon.types.map(type => (
                        <Badge 
                          key={type} 
                          className={`${getTypeColor(type)} text-white text-xs capitalize`}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pokemon Details Dialog */}
      {selectedPokemon && (
        <Dialog open={!!selectedPokemon} onOpenChange={() => {
          setSelectedPokemon(null);
          setEditingNickname(false);
          setEditingMoveset(false);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
                <span>
                  {selectedPokemon.nickname || selectedPokemon.displayName} 
                  {selectedPokemon.nickname && (
                    <span className="text-gray-400 text-lg ml-2">({selectedPokemon.displayName})</span>
                  )}
                </span>
                <span className="text-xl text-gray-400">#{selectedPokemon.id}</span>
                {selectedPokemon.gender && selectedPokemon.gender !== 'genderless' && (
                  <span className="text-2xl">
                    {selectedPokemon.gender === 'male' ? '♂' : '♀'}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <img
                  src={selectedPokemon.sprite}
                  alt={selectedPokemon.displayName}
                  className="w-full"
                />
                <div className="flex gap-2 justify-center">
                  {selectedPokemon.types.map(type => (
                    <Badge 
                      key={type} 
                      className={`${getTypeColor(type)} text-white font-bold capitalize px-4 py-2`}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
                
                {/* Nickname Section */}
                <div className="bg-slate-800 p-3 rounded-lg">
                  <h4 className="text-white font-bold mb-2">Nickname</h4>
                  {editingNickname ? (
                    <div className="space-y-2">
                      <Input
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="Enter nickname..."
                        className="bg-slate-700 text-white border-cyan-500/30"
                        maxLength={12}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpdateNickname}
                          className="flex-1 bg-green-600 hover:bg-green-500"
                          size="sm"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingNickname(false);
                            setNewNickname('');
                          }}
                          className="flex-1 bg-gray-600 hover:bg-gray-500"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        setEditingNickname(true);
                        setNewNickname(selectedPokemon.nickname || '');
                      }}
                      className="w-full bg-cyan-600 hover:bg-cyan-500"
                      size="sm"
                    >
                      {selectedPokemon.nickname ? 'Change Nickname' : 'Set Nickname'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">IVs (Individual Values)</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">HP:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.hp}/31</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">Attack:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.attack}/31</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">Defense:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.defense}/31</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">Sp.Atk:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.spAttack}/31</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">Sp.Def:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.spDefense}/31</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <span className="text-gray-400">Speed:</span>
                      <span className="text-white font-bold ml-2">{selectedPokemon.ivs.speed}/31</span>
                    </div>
                  </div>
                </div>

                {/* Moveset Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white">Moveset</h3>
                    {!editingMoveset && (
                      <Button
                        onClick={() => {
                          setEditingMoveset(true);
                          setSelectedMoves([...selectedPokemon.moveset]);
                          setAvailableMoves(selectedPokemon.allMoves || []);
                        }}
                        className="bg-cyan-600 hover:bg-cyan-500"
                        size="sm"
                      >
                        Edit Moves
                      </Button>
                    )}
                  </div>
                  
                  {editingMoveset ? (
                    <div className="space-y-3">
                      <div className="bg-slate-800 p-3 rounded">
                        <p className="text-sm text-gray-400 mb-2">
                          Selected: {selectedMoves.length}/4 moves
                        </p>
                        <div className="space-y-1">
                          {selectedMoves.map((move, idx) => (
                            <div key={idx} className="bg-cyan-700 p-2 rounded text-white capitalize flex justify-between items-center">
                              <span>{move.replace('-', ' ')}</span>
                              <Button
                                onClick={() => setSelectedMoves(selectedMoves.filter((_, i) => i !== idx))}
                                size="sm"
                                className="bg-red-600 hover:bg-red-500 h-6 px-2"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <ScrollArea className="h-40 bg-slate-800 p-2 rounded">
                        <div className="space-y-1">
                          {availableMoves.map((move, idx) => (
                            <button
                              key={idx}
                              onClick={() => toggleMoveSelection(move)}
                              disabled={selectedMoves.includes(move) || selectedMoves.length >= 4}
                              className={`w-full text-left p-2 rounded capitalize transition-colors ${
                                selectedMoves.includes(move)
                                  ? 'bg-cyan-700 text-white cursor-not-allowed'
                                  : selectedMoves.length >= 4
                                  ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                  : 'bg-slate-700 text-white hover:bg-slate-600'
                              }`}
                            >
                              {move.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpdateMoveset}
                          disabled={selectedMoves.length !== 4}
                          className="flex-1 bg-green-600 hover:bg-green-500"
                        >
                          Save Moveset
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingMoveset(false);
                            setSelectedMoves([]);
                          }}
                          className="flex-1 bg-gray-600 hover:bg-gray-500"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {selectedPokemon.moveset.map((move, idx) => (
                        <div key={idx} className="bg-slate-800 p-2 rounded text-white capitalize">
                          {move.replace('-', ' ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-gray-400 text-sm">
                  Caught: {new Date(selectedPokemon.caughtAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
