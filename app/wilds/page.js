'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, ArrowLeft, Clock, Users } from 'lucide-react';
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
  const [showStats, setShowStats] = useState(true); // Toggle between IVs and Stats - default to Stats
  const [showMovesetDialog, setShowMovesetDialog] = useState(false);
  const [movesetPokemon, setMovesetPokemon] = useState(null);
  
  // Friends and Trading states
  const [friends, setFriends] = useState([]);
  const [friendSearchTerm, setFriendSearchTerm] = useState('');
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [activeTrade, setActiveTrade] = useState(null);
  const [selectedPokemonForTrade, setSelectedPokemonForTrade] = useState([]);
  const [viewingFriendPokemon, setViewingFriendPokemon] = useState(null);
  const [friendPokemonList, setFriendPokemonList] = useState([]);
  const [battleRequests, setBattleRequests] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);
  
  // Leveling and Evolution states
  const [buyingXP, setBuyingXP] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [releasingPokemon, setReleasingPokemon] = useState(false);
  const [evolutionData, setEvolutionData] = useState(null);
  const [fetchingEvolutionData, setFetchingEvolutionData] = useState(false);
  const [showEvolveConfirm, setShowEvolveConfirm] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  // Battle states
  const [activeBattle, setActiveBattle] = useState(null);
  const [showBattleSelection, setShowBattleSelection] = useState(false);
  const [selectedForBattle, setSelectedForBattle] = useState([]);
  const [battleOpponent, setBattleOpponent] = useState(null);
  const [showBattleScreen, setShowBattleScreen] = useState(false);

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
            
            // Load friends directly with the user data (don't wait for state update)
            fetch(`/api/friends?userId=${data.user.id}`)
              .then(res => res.json())
              .then(friendsData => {
                console.log('📥 Friends loaded on page load:', friendsData);
                setFriends(friendsData.friends || []);
                setBattleRequests(friendsData.battleRequests || []);
                setTradeRequests(friendsData.tradeRequests || []);
              })
              .catch(err => console.error('Error loading friends:', err));
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
      const pokemonList = (data.pokemon || []).filter(p => p && p.id); // Filter out null/invalid Pokemon
      
      console.log(`📋 Loaded ${pokemonList.length} Pokemon`);
      pokemonList.forEach(p => {
        if (p.isShiny) {
          console.log(`  ✨ SHINY: ${p.displayName} - isShiny: ${p.isShiny}, sprite: ${p.sprite}`);
        }
      });
      
      setMyPokemon(pokemonList);
    } catch (err) {
      console.error('Error loading Pokemon:', err);
    }
  };

  // Fetch evolution data for a Pokemon
  const fetchEvolutionDataForPokemon = async (pokemon) => {
    if (!pokemon || !pokemon.id || fetchingEvolutionData) return;
    
    setFetchingEvolutionData(true);
    try {
      const response = await fetch('/api/wilds/check-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pokemonId: pokemon.id // Pokemon species ID, not database _id
        })
      });

      const data = await response.json();
      console.log('Evolution data for', pokemon.displayName, ':', data);
      setEvolutionData(data);
    } catch (err) {
      console.error('Error fetching evolution data:', err);
      setEvolutionData(null);
    } finally {
      setFetchingEvolutionData(false);
    }
  };

  const loadFriends = async () => {
    if (!user) return;
    try {
      console.log('🔍 Loading friends for user:', user.id);
      const response = await fetch(`/api/friends?userId=${user.id}`);
      const data = await response.json();
      console.log('📥 Friends API response:', data);
      console.log('👥 Friends array:', data.friends);
      setFriends(data.friends || []);
      setBattleRequests(data.battleRequests || []);
      setTradeRequests(data.tradeRequests || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const handleAddFriend = async () => {
    if (!friendSearchTerm.trim()) return;
    
    try {
      const response = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          targetUsername: friendSearchTerm.trim()
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setFriendSearchTerm('');
        loadFriends();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error adding friend');
    }
  };

  const handleViewFriendPokemon = async (friend) => {
    try {
      const response = await fetch(`/api/wilds/my-pokemon?userId=${friend.id}`);
      const data = await response.json();
      setFriendPokemonList(data.pokemon || []);
      setViewingFriendPokemon(friend);
    } catch (err) {
      alert('Error loading friend Pokemon');
    }
  };

  const handleInitiateTrade = (friend) => {
    setActiveTrade({
      friend: friend,
      myPokemon: [],
      theirPokemon: [],
      status: 'pending'
    });
    setSelectedPokemonForTrade([]);
  };

  const handleSendBattleRequest = async (friend) => {
    try {
      const response = await fetch('/api/battles/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: friend.id
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Battle request sent to ${friend.username}!`);
        loadFriends(); // Reload to update UI
      } else {
        alert(data.error || 'Error sending battle request');
      }
    } catch (err) {
      console.error('Battle request error:', err);
      alert('Error sending battle request');
    }
  };

  const handleAcceptBattleRequest = async (request) => {
    try {
      const response = await fetch('/api/battles/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          requestId: request.id
        })
      });

      const data = await response.json();
      if (data.success) {
        // Navigate to battle page
        window.location.href = `/battle?id=${data.battle.id}`;
      } else {
        alert(data.error || 'Error accepting battle');
      }
    } catch (err) {
      console.error('Accept battle error:', err);
      alert('Error accepting battle');
    }
  };

  const handleDeclineBattleRequest = async (request) => {
    try {
      await fetch('/api/battles/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          requestId: request.id
        })
      });

      loadFriends(); // Reload to update UI
    } catch (err) {
      console.error('Decline battle error:', err);
    }
  };

  const togglePokemonForTrade = (pokemon) => {
    if (selectedPokemonForTrade.find(p => p._id === pokemon._id)) {
      setSelectedPokemonForTrade(selectedPokemonForTrade.filter(p => p._id !== pokemon._id));
    } else {
      setSelectedPokemonForTrade([...selectedPokemonForTrade, pokemon]);
    }
  };

  const handleSendTrade = async () => {
    if (selectedPokemonForTrade.length === 0) {
      alert('Please select at least one Pokemon to trade');
      return;
    }

    try {
      const response = await fetch('/api/friends/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: user.id,
          toId: activeTrade.friend.id,
          offeredPokemon: selectedPokemonForTrade.map(p => ({ pokemonId: p._id.toString(), pokemonData: p })),
          requestedPokemon: [],
          type: 'pokemon-gift'
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Pokemon gift sent!');
        setActiveTrade(null);
        setSelectedPokemonForTrade([]);
        loadMyPokemon();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error sending trade');
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

  const handleAdminSpawnShiny = async () => {
    if (!user || user.username !== 'Spheal') return;
    
    try {
      const response = await fetch('/api/wilds/admin-spawn-shiny', {
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
      alert('Error spawning shiny Pokemon');
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
    const pokemonToUpdate = movesetPokemon || selectedPokemon;
    if (!pokemonToUpdate || selectedMoves.length !== 4) {
      alert('Please select exactly 4 moves');
      return;
    }

    try {
      const response = await fetch('/api/wilds/update-moveset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: pokemonToUpdate._id,
          moveset: selectedMoves
        })
      });

      const data = await response.json();
      if (data.success) {
        if (selectedPokemon) {
          setSelectedPokemon({ ...selectedPokemon, moveset: selectedMoves });
        }
        if (movesetPokemon) {
          setMovesetPokemon({ ...movesetPokemon, moveset: selectedMoves });
        }
        loadMyPokemon();
        alert('Moveset updated successfully!');
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

  // Helper function to calculate XP needed for next level
  const getXPToNextLevel = (currentLevel) => {
    if (currentLevel >= 100) return 0;
    return Math.floor(10 + (currentLevel - 1) * 18);
  };

  const handleBuyXP = async () => {
    if (!selectedPokemon || buyingXP) return;
    
    if (selectedPokemon.level >= 100) {
      alert('Pokemon is already at max level!');
      return;
    }
    
    if (user.username !== 'Spheal' && user.points < 50) {
      alert('Not enough points! Need 50 points.');
      return;
    }

    setBuyingXP(true);
    try {
      const response = await fetch('/api/wilds/buy-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: selectedPokemon._id
        })
      });

      const data = await response.json();
      if (data.success) {
        // Update local user points
        setUser({ ...user, points: data.pointsRemaining });
        
        // Update selected Pokemon
        const updatedPokemon = { 
          ...selectedPokemon, 
          level: data.newLevel, 
          currentXP: data.currentXP 
        };
        setSelectedPokemon(updatedPokemon);
        
        // Reload Pokemon list
        await loadMyPokemon();
        
        if (data.leveledUp) {
          alert(`🎉 Leveled up to ${data.newLevel}!`);
        } else {
          alert('XP purchased successfully!');
        }
      } else {
        alert(data.error || 'Error purchasing XP');
      }
    } catch (err) {
      alert('Error purchasing XP');
    } finally {
      setBuyingXP(false);
    }
  };

  const handleEvolve = async () => {
    if (!selectedPokemon || evolving) return;

    setEvolving(true);
    try {
      const response = await fetch('/api/wilds/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: selectedPokemon._id
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`🎉 ${data.message}`);
        
        // Close dialog and reload
        setSelectedPokemon(null);
        setShowEvolveConfirm(false);
        await loadMyPokemon();
      } else {
        alert(`Cannot evolve: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Evolution error:', err);
      alert('Error evolving Pokemon: ' + err.message);
    } finally {
      setEvolving(false);
    }
  };

  const handleReleasePokemon = async () => {
    if (!selectedPokemon || releasingPokemon) return;

    setReleasingPokemon(true);
    try {
      const response = await fetch('/api/wilds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pokemonId: selectedPokemon._id
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Released ${selectedPokemon.nickname || selectedPokemon.displayName}`);
        
        // Close dialog and reload
        setSelectedPokemon(null);
        setShowReleaseConfirm(false);
        await loadMyPokemon();
      } else {
        alert(data.error || 'Error releasing Pokemon');
      }
    } catch (err) {
      console.error('Release error:', err);
      alert('Error releasing Pokemon: ' + err.message);
    } finally {
      setReleasingPokemon(false);
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
                <>
                  <Button 
                    onClick={handleAdminSpawn}
                    className="bg-red-600 hover:bg-red-500 border-2 border-red-400 font-bold"
                  >
                    ⚡ Spawn Pokemon
                  </Button>
                  <Button 
                    onClick={handleAdminSpawnShiny}
                    className="bg-yellow-600 hover:bg-yellow-500 border-2 border-yellow-400 font-bold"
                  >
                    ✨ Spawn Shiny
                  </Button>
                </>
              )}
              <Button 
                onClick={() => setShowFriendsPanel(true)}
                className="bg-blue-600 hover:bg-blue-500"
              >
                <Users className="mr-2 h-4 w-4" />
                Friends ({friends.length})
              </Button>
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
                <p className="text-sm text-yellow-400 font-bold">⭐ {user.points} Points</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="max-w-7xl mx-auto p-8 mt-12">
          {spawn && spawn.pokemon ? (
            <div className="text-center">
              {/* Pokemon Display */}
              <div className="mb-8 animate-bounce-slow relative">
                {spawn.pokemon.isShiny && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="text-4xl animate-pulse">✨</div>
                    <div className="text-yellow-400 font-bold text-sm">SHINY!</div>
                  </div>
                )}
                <img
                  src={spawn.pokemon.sprite}
                  alt={spawn.pokemon.displayName}
                  className="w-64 h-64 mx-auto drop-shadow-2xl filter brightness-110"
                  style={{
                    filter: spawn.pokemon.isShiny 
                      ? 'drop-shadow(0 0 40px rgba(234, 179, 8, 0.9)) brightness(1.2)' 
                      : 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.7))'
                  }}
                />
              </div>

              {/* Pokemon Info */}
              <Card className="bg-slate-900/90 border-cyan-500/50 border-2 max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-3xl text-cyan-400 flex items-center justify-center gap-2">
                    {spawn.pokemon.displayName}
                    {spawn.pokemon.isShiny && <span className="text-yellow-400">✨</span>}
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
                  className={`bg-slate-800/90 border-purple-500/30 cursor-pointer hover:border-purple-500 transition-all ${
                    pokemon.isShiny ? 'ring-2 ring-yellow-400' : ''
                  }`}
                  onClick={() => {
                    setSelectedPokemon(pokemon);
                    fetchEvolutionDataForPokemon(pokemon);
                  }}
                >
                  <CardContent className="p-4 relative">
                    <img
                      src={pokemon.sprite}
                      alt={pokemon.displayName}
                      className="w-24 h-24 mx-auto mb-2"
                      style={{
                        filter: pokemon.isShiny ? 'brightness(1.2) drop-shadow(0 0 10px rgba(234, 179, 8, 0.6))' : 'none'
                      }}
                    />
                    <h3 className="text-center font-bold text-white flex items-center justify-center gap-1">
                      {pokemon.isShiny && <span className="text-yellow-400 text-sm">✨</span>}
                      {pokemon.nickname || pokemon.displayName}
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
          setEvolutionData(null);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-cyan-400 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  {selectedPokemon.nickname || selectedPokemon.displayName}
                  {selectedPokemon.isShiny && <span className="text-yellow-400 text-2xl">✨</span>}
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
                  style={{
                    filter: selectedPokemon.isShiny ? 'brightness(1.2) drop-shadow(0 0 20px rgba(234, 179, 8, 0.8))' : 'none'
                  }}
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
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white">{showStats ? 'Stats' : 'IVs'}</h3>
                    <Button
                      onClick={() => setShowStats(!showStats)}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-500"
                    >
                      Show {showStats ? 'IVs' : 'Stats'}
                    </Button>
                  </div>
                  
                  {showStats ? (
                    // Show actual stats
                    <div className="space-y-2">
                      <div className="bg-slate-800 p-2 rounded flex justify-between items-center">
                        <span className="text-gray-400">Level:</span>
                        <span className="text-yellow-400 font-bold text-lg">{selectedPokemon.level || 50}</span>
                      </div>
                      
                      {/* XP Progress Bar */}
                      {selectedPokemon.level < 100 && (
                        <div className="bg-slate-800 p-3 rounded space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-cyan-400 font-bold">XP Progress</span>
                            <span className="text-white">
                              {selectedPokemon.currentXP || 0} / {getXPToNextLevel(selectedPokemon.level || 1)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, ((selectedPokemon.currentXP || 0) / getXPToNextLevel(selectedPokemon.level || 1)) * 100)}%` 
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleBuyXP}
                              disabled={buyingXP || selectedPokemon.level >= 100 || (user.username !== 'Spheal' && user.points < 50)}
                              className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                              size="sm"
                            >
                              {buyingXP ? 'Buying...' : 'Buy 50 XP (50 Points)'}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {selectedPokemon.level >= 100 && (
                        <div className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/50 p-3 rounded text-center">
                          <span className="text-yellow-400 font-bold text-lg">🏆 MAX LEVEL 🏆</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">HP:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.hp || 0}</span>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">Attack:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.attack || 0}</span>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">Defense:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.defense || 0}</span>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">Sp.Atk:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.spAttack || 0}</span>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">Sp.Def:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.spDefense || 0}</span>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                          <span className="text-gray-400">Speed:</span>
                          <span className="text-white font-bold ml-2">{selectedPokemon.stats?.speed || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Show IVs
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
                  )}
                </div>

                {/* Moveset Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white">Moveset</h3>
                    <Button
                      onClick={() => {
                        setMovesetPokemon(selectedPokemon);
                        setSelectedMoves([...selectedPokemon.moveset]);
                        setAvailableMoves(selectedPokemon.allMoves || []);
                        setShowMovesetDialog(true);
                      }}
                      className="bg-cyan-600 hover:bg-cyan-500"
                      size="sm"
                    >
                      Edit Moves
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedPokemon.moveset.map((moveName, idx) => {
                      const moveData = selectedPokemon.allMovesData?.find(m => m.name === moveName);
                      return (
                        <div key={idx} className="bg-slate-800 p-3 rounded">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="text-white font-bold capitalize">{moveName.replace('-', ' ')}</h4>
                              {moveData && (
                                <div className="text-xs mt-1 space-y-1">
                                  <div className="flex gap-2 flex-wrap">
                                    <Badge className={`${getTypeColor(moveData.type)} text-white capitalize px-2 py-0.5`}>
                                      {moveData.type}
                                    </Badge>
                                    <Badge className="bg-gray-700 text-white px-2 py-0.5">
                                      {moveData.damageClass}
                                    </Badge>
                                    {moveData.power && (
                                      <span className="text-red-400 font-bold">PWR: {moveData.power}</span>
                                    )}
                                    {moveData.accuracy && (
                                      <span className="text-blue-400 font-bold">ACC: {moveData.accuracy}%</span>
                                    )}
                                    {moveData.pp && (
                                      <span className="text-cyan-400 font-bold">PP: {moveData.pp}</span>
                                    )}
                                  </div>
                                  {moveData.ailment && moveData.ailment !== 'none' && (
                                    <div className="text-yellow-400">
                                      Status: {moveData.ailment} ({moveData.ailmentChance}% chance)
                                    </div>
                                  )}
                                  {moveData.statChanges && moveData.statChanges.length > 0 && (
                                    <div className="text-green-400">
                                      {moveData.statChanges.map((sc, i) => (
                                        <span key={i}>
                                          {sc.change > 0 ? '+' : ''}{sc.change} {sc.stat}
                                          {i < moveData.statChanges.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evolution and Release Buttons */}
                <div className="space-y-2">
                  {/* Only show evolve button if Pokemon can evolve */}
                  {evolutionData && evolutionData.canEvolve && (
                    <div>
                      {!showEvolveConfirm ? (
                        <Button
                          onClick={() => setShowEvolveConfirm(true)}
                          disabled={evolving || (evolutionData.minLevel && selectedPokemon.level < evolutionData.minLevel)}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed font-bold text-lg py-6"
                        >
                          ✨ Evolve Pokemon ✨
                        </Button>
                      ) : (
                        <div className="bg-purple-900 p-4 rounded space-y-2">
                          <p className="text-white text-center">Evolve {selectedPokemon.nickname || selectedPokemon.displayName}?</p>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleEvolve}
                              disabled={evolving}
                              className="flex-1 bg-green-600 hover:bg-green-500"
                            >
                              {evolving ? 'Evolving...' : 'Yes'}
                            </Button>
                            <Button
                              onClick={() => setShowEvolveConfirm(false)}
                              className="flex-1 bg-gray-600 hover:bg-gray-500"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      {evolutionData.minLevel && selectedPokemon.level < evolutionData.minLevel && (
                        <p className="text-gray-400 text-xs text-center mt-1">
                          Requires level {evolutionData.minLevel}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {!showReleaseConfirm ? (
                    <Button
                      onClick={() => setShowReleaseConfirm(true)}
                      disabled={releasingPokemon}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-bold"
                    >
                      🗑️ Release Pokemon
                    </Button>
                  ) : (
                    <div className="bg-red-900 p-4 rounded space-y-2">
                      <p className="text-white text-center">Release {selectedPokemon.nickname || selectedPokemon.displayName}? Cannot be undone!</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleReleasePokemon}
                          disabled={releasingPokemon}
                          className="flex-1 bg-red-600 hover:bg-red-500"
                        >
                          {releasingPokemon ? 'Releasing...' : 'Yes, Release'}
                        </Button>
                        <Button
                          onClick={() => setShowReleaseConfirm(false)}
                          className="flex-1 bg-gray-600 hover:bg-gray-500"
                        >
                          Cancel
                        </Button>
                      </div>
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

      {/* Moveset Editing Dialog */}
      <Dialog open={showMovesetDialog} onOpenChange={() => {
        setShowMovesetDialog(false);
        setMovesetPokemon(null);
        setSelectedMoves([]);
      }}>
        <DialogContent className="max-w-2xl border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400">
              Edit Moveset - {movesetPokemon?.displayName}
            </DialogTitle>
          </DialogHeader>

          {movesetPokemon && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-3">
                  Selected: {selectedMoves.length}/4 moves
                </p>
                <div className="space-y-2">
                  {selectedMoves.map((move, idx) => (
                    <div key={idx} className="bg-cyan-700 p-3 rounded text-white capitalize flex justify-between items-center">
                      <span className="font-medium">{move.replace('-', ' ')}</span>
                      <Button
                        onClick={() => setSelectedMoves(selectedMoves.filter((_, i) => i !== idx))}
                        size="sm"
                        className="bg-red-600 hover:bg-red-500 h-7 px-3"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {selectedMoves.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No moves selected</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">Available Moves ({availableMoves.length})</h3>
                <ScrollArea className="h-64 bg-slate-800 p-3 rounded-lg">
                  <div className="space-y-2">
                    {availableMoves.map((move, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleMoveSelection(move)}
                        disabled={selectedMoves.includes(move) || (selectedMoves.length >= 4 && !selectedMoves.includes(move))}
                        className={`w-full text-left p-3 rounded capitalize transition-colors font-medium ${
                          selectedMoves.includes(move)
                            ? 'bg-cyan-700 text-white cursor-not-allowed opacity-50'
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
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    setShowMovesetDialog(false);
                    setMovesetPokemon(null);
                    setSelectedMoves([]);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedMoves.length !== 4) {
                      alert('Please select exactly 4 moves');
                      return;
                    }
                    await handleUpdateMoveset();
                    setShowMovesetDialog(false);
                  }}
                  disabled={selectedMoves.length !== 4}
                  className="flex-1 bg-green-600 hover:bg-green-500 font-bold"
                >
                  Save Moveset ({selectedMoves.length}/4)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Friends Panel Dialog */}
      <Dialog open={showFriendsPanel} onOpenChange={setShowFriendsPanel}>
        <DialogContent className="max-w-4xl max-h-[90vh] border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
              <Users className="h-6 w-6" />
              Friends & Battles
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              {/* Add Friend */}
              <Card className="border-2 border-green-500/30 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-green-400">Add Friend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter friend's username..."
                      value={friendSearchTerm}
                      onChange={(e) => setFriendSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                      className="border-2 border-green-500/30 bg-slate-700/50 text-white"
                    />
                    <Button
                      onClick={handleAddFriend}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Friends List */}
              <Card className="border-2 border-cyan-500/30 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-cyan-400">My Friends ({friends.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {friends.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No friends yet. Add friends to trade and battle!</p>
                  ) : (
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div 
                          key={friend.id}
                          className="flex items-center justify-between p-3 bg-slate-700/50 rounded"
                        >
                          <div>
                            <p className="text-white font-bold">{friend.username}</p>
                            <p className="text-xs text-gray-400">{friend.tradesCompleted || 0} trades completed</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                handleViewFriendPokemon(friend);
                              }}
                              className="bg-purple-600 hover:bg-purple-500 text-xs"
                            >
                              Trade Pokemon
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSendBattleRequest(friend)}
                              className="bg-red-600 hover:bg-red-500 text-xs"
                            >
                              ⚔️ Battle
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Battle Requests */}
              <Card className="border-2 border-red-500/30 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-red-400">Battle Requests ({battleRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {battleRequests.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No battle requests</p>
                  ) : (
                    <div className="space-y-2">
                      {battleRequests.map(request => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
                          <div>
                            <p className="text-white font-bold">{request.from.username}</p>
                            <p className="text-xs text-gray-400">wants to battle!</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptBattleRequest(request)}
                              className="bg-green-600 hover:bg-green-500"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeclineBattleRequest(request)}
                              className="bg-gray-600 hover:bg-gray-500"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trade Requests */}
              {tradeRequests && tradeRequests.length > 0 && (
                <Card className="border-2 border-purple-500/30 bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-purple-400">Pokemon Trade Requests ({tradeRequests.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tradeRequests.map((trade) => (
                        <div key={trade.id} className="p-3 bg-slate-700/50 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-bold">{trade.fromUsername}</span>
                            <Badge className="bg-purple-500">{trade.offeredPokemon?.length || 0} Pokemon</Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {/* Handle view trade */}}
                            className="w-full bg-purple-600 hover:bg-purple-500"
                          >
                            View Trade
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
}
