'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Package, Library, LogOut, Coins, Search, Clock, Eye, Users, Send, X, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sets, setSets] = useState([]);
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingPack, setOpeningPack] = useState(false);
  const [pulledCards, setPulledCards] = useState([]);
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);
  const [activeTab, setActiveTab] = useState('packs');
  const [selectedCard, setSelectedCard] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [packSearchQuery, setPackSearchQuery] = useState('');
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);
  const [earnedAchievements, setEarnedAchievements] = useState(null);
  const [previewSet, setPreviewSet] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  
  // Collection filters
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [setFilter, setSetFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // Default to newest

  useEffect(() => {
    // Check if user is logged in
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      fetch(`/api/session?userId=${storedUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setUser(data.user);
            setCountdown(data.user.nextPointsIn || 0);
          } else {
            localStorage.removeItem('userId');
          }
        });
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (user && user.username !== 'Spheal' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Refresh user data when countdown reaches 0
            fetch(`/api/session?userId=${user.id}`)
              .then(res => res.json())
              .then(data => {
                if (data.authenticated) {
                  setUser(data.user);
                  return data.user.nextPointsIn || 0;
                }
              });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [user, countdown]);

  // Format countdown as HH:MM:SS (with zero-padding for hours)
  const formatCountdown = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (user) {
      loadSets();
      loadCollection();
    }
  }, [user]);

  // Filtered collection based on search and filters
  const filteredCollection = useMemo(() => {
    let filtered = [...collection];

    // Search by name
    if (searchQuery) {
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by rarity
    if (rarityFilter !== 'all') {
      filtered = filtered.filter(card => card.rarity === rarityFilter);
    }

    // Filter by set
    if (setFilter !== 'all') {
      filtered = filtered.filter(card => card.set?.id === setFilter);
    }

    // Filter by type (illustration, full art, reverse holo)
    if (typeFilter !== 'all') {
      if (typeFilter === 'reverse') {
        filtered = filtered.filter(card => card.isReverseHolo);
      } else if (typeFilter === 'full-art') {
        filtered = filtered.filter(card => 
          card.rarity && (card.rarity.includes('Full Art') || card.subtypes?.includes('Full Art'))
        );
      } else if (typeFilter === 'illustration') {
        filtered = filtered.filter(card => 
          card.rarity && card.rarity.includes('Illustration')
        );
      }
    }

    return filtered;
  }, [collection, searchQuery, rarityFilter, setFilter, typeFilter]);

  // Helper to get card type (with fixes) - MOVED BEFORE USE
  const getCardType = (card) => {
    if (!card) return 'Unknown';
    
    if (card.supertype === 'Trainer') {
      return card.subtypes?.[0] || 'Trainer';
    }
    if (card.types && card.types.length > 0) {
      // Change Darkness to Dark
      return card.types[0] === 'Darkness' ? 'Dark' : card.types[0];
    }
    return 'Unknown';
  };

  // Helper to check if card is new (within 30 minutes)
  const isCardNew = (card) => {
    if (!card.pulledAt || card.viewed) return false;
    const pulledTime = new Date(card.pulledAt).getTime();
    const now = new Date().getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    return (now - pulledTime) < thirtyMinutes;
  };

  // Group duplicates and sort
  const groupedAndSortedCollection = useMemo(() => {
    // Group by card ID
    const cardMap = new Map();
    filteredCollection.forEach(card => {
      const key = card.id;
      if (cardMap.has(key)) {
        cardMap.get(key).count++;
        // Keep the earliest pulled card for "newest" logic
        if (new Date(card.pulledAt) > new Date(cardMap.get(key).pulledAt)) {
          cardMap.get(key).pulledAt = card.pulledAt;
        }
      } else {
        cardMap.set(key, { ...card, count: 1 });
      }
    });

    let grouped = Array.from(cardMap.values());

    // Sort
    if (sortBy === 'newest') {
      grouped.sort((a, b) => new Date(b.pulledAt) - new Date(a.pulledAt));
    } else if (sortBy === 'name') {
      grouped.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'set') {
      grouped.sort((a, b) => (a.set?.name || '').localeCompare(b.set?.name || ''));
    } else if (sortBy === 'type') {
      grouped.sort((a, b) => {
        const typeA = getCardType(a);
        const typeB = getCardType(b);
        return typeA.localeCompare(typeB);
      });
    } else if (sortBy === 'rarity') {
      const rarityOrder = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Rare Holo': 4, 'Rare Ultra': 5 };
      grouped.sort((a, b) => {
        const orderA = rarityOrder[a.rarity] || 999;
        const orderB = rarityOrder[b.rarity] || 999;
        return orderA - orderB;
      });
    }

    return grouped;
  }, [filteredCollection, sortBy]);

  // Get unique rarities and sets from collection
  const uniqueRarities = useMemo(() => {
    const rarities = new Set(collection.map(card => card.rarity).filter(Boolean));
    return Array.from(rarities).sort();
  }, [collection]);

  const uniqueSets = useMemo(() => {
    const sets = new Map();
    collection.forEach(card => {
      if (card.set) {
        sets.set(card.set.id, card.set.name);
      }
    });
    return Array.from(sets.entries()).map(([id, name]) => ({ id, name }));
  }, [collection]);

  // Filtered packs based on search
  const filteredPacks = useMemo(() => {
    if (!packSearchQuery) return sets;
    return sets.filter(set => 
      set.name.toLowerCase().includes(packSearchQuery.toLowerCase()) ||
      set.series.toLowerCase().includes(packSearchQuery.toLowerCase())
    );
  }, [sets, packSearchQuery]);

  const loadSets = async () => {
    try {
      const response = await fetch('/api/sets');
      const data = await response.json();
      setSets(data.sets || []);
    } catch (err) {
      console.error('Error loading sets:', err);
    }
  };

  const loadCollection = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/collection?userId=${user.id}`);
      const data = await response.json();
      setCollection(data.collection || []);
    } catch (err) {
      console.error('Error loading collection:', err);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userId', data.user.id);
        setUser(data.user);
        setCountdown(data.user.nextPointsIn || 0);
        setUsername('');
        setPassword('');
      } else {
        setError(data.error || 'Sign up failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userId', data.user.id);
        setUser(data.user);
        setCountdown(data.user.nextPointsIn || 0);
        setUsername('');
        setPassword('');
      } else {
        setError(data.error || 'Sign in failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('userId');
    setUser(null);
    setCollection([]);
    setSets([]);
  };

  // Admin command console state
  const [adminTargetUser, setAdminTargetUser] = useState('');
  const [adminPointAmount, setAdminPointAmount] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminRemoveUser, setAdminRemoveUser] = useState('');

  const handleSendPoints = async (e) => {
    e.preventDefault();
    setAdminMessage('');
    
    const points = parseInt(adminPointAmount);
    if (isNaN(points) || points <= 0) {
      setAdminMessage('Please enter a valid point amount');
      return;
    }

    try {
      const response = await fetch('/api/admin/send-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId: user.id, 
          targetUsername: adminTargetUser, 
          points: points 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAdminMessage(`✅ Successfully sent ${points} points to ${adminTargetUser}`);
        setAdminTargetUser('');
        setAdminPointAmount('');
      } else {
        setAdminMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setAdminMessage('❌ An error occurred. Please try again.');
    }
  };

  const handleRemoveCollection = async (e) => {
    e.preventDefault();
    setAdminMessage('');
    
    if (!adminRemoveUser) {
      setAdminMessage('Please enter a username');
      return;
    }

    // Confirmation
    if (!window.confirm(`Are you sure you want to DELETE the entire collection for user "${adminRemoveUser}"? This cannot be undone!`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/remove-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId: user.id, 
          targetUsername: adminRemoveUser
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAdminMessage(`✅ Successfully removed collection for ${adminRemoveUser}`);
        setAdminRemoveUser('');
      } else {
        setAdminMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setAdminMessage('❌ An error occurred. Please try again.');
    }
  };

  const handleOpenPack = async (set, bulk = false) => {
    setSelectedSet(set);
    setOpeningPack(true);
    setShowPackAnimation(true);

    try {
      const response = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, setId: set.id, bulk })
      });

      const data = await response.json();

      if (response.ok) {
        // Simulate pack opening animation
        setTimeout(() => {
          // Mark cards as new if not already owned
          const ownedCardIds = new Set(collection.map(c => c.id));
          const cardsWithNewFlag = data.cards.map(card => ({
            ...card,
            isNewCard: !ownedCardIds.has(card.id)
          }));
          
          setPulledCards(cardsWithNewFlag);
          setShowPackAnimation(false);
          setUser(prev => ({ ...prev, points: data.pointsRemaining }));
          
          // Check for achievements
          if (data.achievements) {
            setEarnedAchievements(data.achievements);
            setShowAchievementDialog(true);
          }
          
          loadCollection();
        }, 2000);
      } else {
        setError(data.error || 'Failed to open pack');
        setShowPackAnimation(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setShowPackAnimation(false);
    } finally {
      setOpeningPack(false);
    }
  };

  const closePackResults = () => {
    setPulledCards([]);
    setSelectedSet(null);
  };

  const handlePreviewSet = async (set) => {
    setPreviewSet(set);
    setPreviewCards([]);
    
    try {
      const response = await fetch(`/api/cards?setId=${set.id}`);
      const data = await response.json();
      if (response.ok) {
        // Filter out energy cards from preview
        const nonEnergyCards = (data.cards || []).filter(card => card.supertype !== 'Energy');
        setPreviewCards(nonEnergyCards);
      }
    } catch (err) {
      console.error('Error loading preview:', err);
    }
  };

  const closePreview = () => {
    setPreviewSet(null);
    setPreviewCards([]);
  };

  const handleCardClick = (card) => {
    setSelectedCard(card);
    
    // Mark card as viewed to remove NEW badge
    if (isCardNew(card)) {
      const updatedCollection = collection.map(c => {
        if (c.id === card.id && c.pulledAt === card.pulledAt) {
          return { ...c, viewed: true };
        }
        return c;
      });
      setCollection(updatedCollection);
    }
  };

  const getRarityColor = (rarity) => {
    if (!rarity) return 'bg-gray-500';
    if (rarity === 'Common') return 'bg-gray-500';
    if (rarity === 'Uncommon') return 'bg-green-500';
    if (rarity.includes('Rare') || rarity.includes('Holo')) return 'bg-purple-500';
    if (rarity.includes('Ultra')) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Auth screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        
        <Card className="w-full max-w-md border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.3)] bg-slate-900/90 backdrop-blur-xl relative z-10">
          <CardHeader className="text-center border-b-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
            <div className="flex justify-center mb-4">
              <Sparkles className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            </div>
            <CardTitle className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">Pokemon Pack Ripper</CardTitle>
            <CardDescription className="text-cyan-100/80 font-medium">Sign in to start opening packs and build your collection!</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-cyan-500/20">
                <TabsTrigger value="signin" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] text-cyan-100">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] text-cyan-100">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-username" className="text-cyan-100 font-semibold">Username</Label>
                    <Input
                      id="signin-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-2 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-cyan-100 font-semibold">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-2 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-red-400 font-semibold">{error}</p>}
                  <Button type="submit" className="w-full bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username" className="text-cyan-100 font-semibold">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="border-2 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-cyan-100 font-semibold">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-2 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-red-400 font-semibold">{error}</p>}
                  <Button type="submit" className="w-full bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main app screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black relative overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b-2 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            <h1 className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">Pokemon Pack Ripper</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-lg border-2 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-sm">
              <Coins className="h-5 w-5 text-cyan-400" />
              <span className="font-bold text-cyan-400">{user.points || 0}</span>
              {user.username !== 'Spheal' && countdown > 0 && (
                <>
                  <span className="text-cyan-500/50">|</span>
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-400">{formatCountdown(countdown)}</span>
                </>
              )}
            </div>
            <span className="text-cyan-100 font-medium">Welcome, {user.username}!</span>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-slate-800/50 text-cyan-400 hover:bg-cyan-500 hover:text-black border-2 border-cyan-500/30 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Admin Command Console (Only for Spheal) */}
      {user.username === 'Spheal' && (
        <div className="container mx-auto px-4 py-4 relative z-10">
          <div className="bg-gradient-to-r from-purple-900/50 via-purple-800/50 to-purple-900/50 backdrop-blur-sm border-2 border-purple-500/50 rounded-lg p-4 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <h3 className="text-lg font-bold text-purple-300">Admin Command Console</h3>
            </div>
            
            {/* Send Points Command */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-purple-200 mb-2">💰 Send Points</h4>
              <form onSubmit={handleSendPoints} className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Username"
                    value={adminTargetUser}
                    onChange={(e) => setAdminTargetUser(e.target.value)}
                    className="border-2 border-purple-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 font-medium focus:border-purple-500"
                    required
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Points Amount"
                    value={adminPointAmount}
                    onChange={(e) => setAdminPointAmount(e.target.value)}
                    className="border-2 border-purple-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 font-medium focus:border-purple-500"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  className="bg-purple-500 text-white hover:bg-purple-400 border-2 border-purple-400 font-bold shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all"
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Send Points
                </Button>
              </form>
            </div>

            {/* Remove Collection Command */}
            <div className="border-t border-purple-500/30 pt-4">
              <h4 className="text-sm font-semibold text-purple-200 mb-2">🗑️ Remove Collection</h4>
              <form onSubmit={handleRemoveCollection} className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Username"
                    value={adminRemoveUser}
                    onChange={(e) => setAdminRemoveUser(e.target.value)}
                    className="border-2 border-red-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 font-medium focus:border-red-500"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  className="bg-red-500 text-white hover:bg-red-400 border-2 border-red-400 font-bold shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.8)] transition-all"
                >
                  <Library className="h-4 w-4 mr-2" />
                  Remove Collection
                </Button>
              </form>
            </div>

            {adminMessage && (
              <p className={`mt-3 text-sm font-medium ${adminMessage.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {adminMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6 bg-slate-800/50 backdrop-blur-sm h-12 border-2 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <TabsTrigger value="packs" className="flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Package className="h-4 w-4" />
              Open Packs
            </TabsTrigger>
            <TabsTrigger value="collection" className="flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Library className="h-4 w-4" />
              My Collection
            </TabsTrigger>
          </TabsList>

          {/* Open Packs Tab */}
          <TabsContent value="packs" className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-2">Choose Your Pack</h2>
              <p className="text-cyan-100/70 font-medium">Select a Pokemon TCG set to open a booster pack (100 points per pack)</p>
            </div>

            {/* Pack Search */}
            <div className="max-w-md mx-auto mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-cyan-400" />
                <Input
                  placeholder="Search packs..."
                  value={packSearchQuery}
                  onChange={(e) => setPackSearchQuery(e.target.value)}
                  className="pl-9 border-2 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-400 font-medium focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                />
              </div>
              {packSearchQuery && (
                <p className="text-cyan-100/70 text-sm mt-2 text-center">
                  Found {filteredPacks.length} pack{filteredPacks.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            <ScrollArea className="h-[600px] rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPacks.length === 0 ? (
                  <div className="col-span-full text-center py-20">
                    <Search className="h-20 w-20 text-cyan-400/30 mx-auto mb-4" />
                    <p className="text-white text-lg font-medium mb-4">No packs match your search</p>
                    <Button
                      onClick={() => setPackSearchQuery('')}
                      className="bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                    >
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  filteredPacks.map((set) => {
                    const canAfford = user.points >= 100 || user.username === 'Spheal';
                    return (
                      <Card key={set.id} className="overflow-hidden hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 hover:border-cyan-500/60 group">
                        <CardHeader className="p-0">
                          <div className="h-48 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center border-b-2 border-cyan-500/30 group-hover:border-cyan-500/60 transition-all">
                            {set.images?.logo ? (
                              <img
                                src={set.images.logo}
                                alt={set.name}
                                className="max-h-40 max-w-full object-contain p-4 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                              />
                            ) : (
                              <Package className="h-20 w-20 text-cyan-400" />
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <CardTitle className="text-lg mb-2 text-white">{set.name}</CardTitle>
                          <CardDescription className="text-sm mb-3 text-cyan-100/70 font-medium">
                            {set.series} • {set.total} cards
                          </CardDescription>
                          <div className="space-y-2">
                            <Button 
                              className="w-full font-bold border-2 transition-all bg-slate-700 text-cyan-400 hover:bg-slate-600 border-slate-600 hover:border-cyan-500/50 text-sm"
                              onClick={() => handlePreviewSet(set)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview Cards
                            </Button>
                            <Button 
                              className={`w-full font-bold border-2 transition-all ${
                                canAfford 
                                  ? 'bg-cyan-500 text-black hover:bg-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)]' 
                                  : 'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              onClick={() => handleOpenPack(set, false)}
                              disabled={openingPack || !canAfford}
                            >
                              {canAfford ? (
                                <>
                                  <Coins className="h-4 w-4 mr-2" />
                                  Open Pack (100)
                                </>
                              ) : (
                                'Not Enough Points'
                              )}
                            </Button>
                            <Button 
                              className={`w-full font-bold border-2 transition-all text-sm ${
                                (user.points >= 1000 || user.username === 'Spheal')
                                  ? 'bg-purple-500 text-white hover:bg-purple-400 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_25px_rgba(168,85,247,0.8)]' 
                                  : 'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              onClick={() => handleOpenPack(set, true)}
                              disabled={openingPack || (user.points < 1000 && user.username !== 'Spheal')}
                            >
                              {(user.points >= 1000 || user.username === 'Spheal') ? (
                                <>
                                  <Package className="h-4 w-4 mr-2" />
                                  Open 10 Packs (1000)
                                </>
                              ) : (
                                'Not Enough Points'
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Collection Tab */}
          <TabsContent value="collection" className="space-y-6 collection-background rounded-lg p-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-2">My Collection</h2>
              <div className="flex items-center justify-center gap-4 text-cyan-100/70 font-medium">
                <span>{collection.length} total cards</span>
                <span>•</span>
                <span>{groupedAndSortedCollection.length} unique cards</span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg p-4 mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-cyan-400" />
                  <Input
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 border-2 border-cyan-500/30 bg-slate-700/50 text-white placeholder:text-slate-400 font-medium focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="border-2 border-cyan-500/30 bg-slate-700/50 text-white font-medium focus:border-cyan-500">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-cyan-500/30 text-white">
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                    <SelectItem value="rarity">Rarity</SelectItem>
                    <SelectItem value="none">No Sort</SelectItem>
                  </SelectContent>
                </Select>

                {/* Rarity Filter */}
                <Select value={rarityFilter} onValueChange={setRarityFilter}>
                  <SelectTrigger className="border-2 border-cyan-500/30 bg-slate-700/50 text-white font-medium focus:border-cyan-500">
                    <SelectValue placeholder="Filter by Rarity" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-cyan-500/30 text-white">
                    <SelectItem value="all">All Rarities</SelectItem>
                    {uniqueRarities.map(rarity => (
                      <SelectItem key={rarity} value={rarity}>{rarity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Set Filter */}
                <Select value={setFilter} onValueChange={setSetFilter}>
                  <SelectTrigger className="border-2 border-cyan-500/30 bg-slate-700/50 text-white font-medium focus:border-cyan-500">
                    <SelectValue placeholder="Filter by Set" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-cyan-500/30 text-white">
                    <SelectItem value="all">All Sets</SelectItem>
                    {uniqueSets.map(set => (
                      <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="border-2 border-cyan-500/30 bg-slate-700/50 text-white font-medium focus:border-cyan-500">
                    <SelectValue placeholder="Filter by Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-cyan-500/30 text-white">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reverse">Reverse Holo</SelectItem>
                    <SelectItem value="full-art">Full Art</SelectItem>
                    <SelectItem value="illustration">Illustration Rare</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters Display */}
              {(searchQuery || rarityFilter !== 'all' || setFilter !== 'all' || typeFilter !== 'all' || sortBy !== 'none') && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-cyan-400">Active:</span>
                  {searchQuery && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Search: {searchQuery}
                    </Badge>
                  )}
                  {sortBy !== 'none' && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Sort: {sortBy}
                    </Badge>
                  )}
                  {rarityFilter !== 'all' && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Rarity: {rarityFilter}
                    </Badge>
                  )}
                  {setFilter !== 'all' && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Set: {uniqueSets.find(s => s.id === setFilter)?.name}
                    </Badge>
                  )}
                  {typeFilter !== 'all' && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Type: {typeFilter}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setRarityFilter('all');
                      setSetFilter('all');
                      setTypeFilter('all');
                      setSortBy('newest');
                    }}
                    className="h-6 text-xs border-cyan-500/30 bg-slate-700/50 text-cyan-400 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
            
            <ScrollArea className="h-[600px] rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {groupedAndSortedCollection.length === 0 && collection.length > 0 ? (
                  <div className="col-span-full text-center py-20">
                    <Search className="h-20 w-20 text-cyan-400/30 mx-auto mb-4" />
                    <p className="text-white text-lg font-medium">No cards match your filters</p>
                    <Button
                      onClick={() => {
                        setSearchQuery('');
                        setRarityFilter('all');
                        setSetFilter('all');
                        setTypeFilter('all');
                        setSortBy('newest');
                      }}
                      className="mt-4 bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)]"
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : groupedAndSortedCollection.length === 0 ? (
                  <div className="col-span-full text-center py-20">
                    <Package className="h-20 w-20 text-cyan-400/30 mx-auto mb-4" />
                    <p className="text-white text-lg font-medium">No cards yet! Open some packs to start your collection.</p>
                  </div>
                ) : (
                  groupedAndSortedCollection.map((card) => (
                    <Card 
                      key={card.id} 
                      className="overflow-visible hover:scale-110 hover:z-50 transition-transform bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 hover:border-cyan-500 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] cursor-pointer relative"
                      onClick={() => handleCardClick(card)}
                    >
                      <div className="relative">
                        <img
                          src={card.images?.small || '/placeholder.png'}
                          alt={card.name}
                          className="w-full h-auto rounded-t"
                        />
                        {/* NEW Badge */}
                        {isCardNew(card) && (
                          <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-2 border-yellow-300 text-xs font-bold px-2 py-1 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-pulse">
                            NEW
                          </Badge>
                        )}
                        {/* Count Badge */}
                        {card.count > 1 && (
                          <Badge className={`absolute ${isCardNew(card) ? 'top-10' : 'top-2'} left-2 bg-cyan-500 text-black border-2 border-cyan-400 text-lg font-bold px-2 py-1 shadow-[0_0_15px_rgba(6,182,212,0.6)]`}>
                            x{card.count}
                          </Badge>
                        )}
                        {card.isReverseHolo && (
                          <Badge className="absolute top-2 right-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white border border-cyan-300 text-xs shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            Reverse
                          </Badge>
                        )}
                        <Badge className={`absolute bottom-2 left-2 border-2 border-cyan-500/50 text-xs shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                          {card.rarity || 'Common'}
                        </Badge>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pack Opening Animation Dialog */}
      <Dialog open={showPackAnimation} onOpenChange={() => {}}>
        <DialogContent className="max-w-md border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_50px_rgba(6,182,212,0.5)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">Opening Pack...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <Package className="h-32 w-32 text-cyan-400 animate-bounce drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
              <Sparkles className="h-8 w-8 text-cyan-400 absolute -top-2 -right-2 animate-spin drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
            </div>
            <p className="mt-4 text-lg font-bold text-cyan-100">Ripping open your {selectedSet?.name} pack...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pack Results Dialog */}
      <Dialog open={pulledCards.length > 0} onOpenChange={closePackResults}>
        <DialogContent className="max-w-4xl max-h-[90vh] border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white bg-gradient-to-r from-cyan-500/20 to-transparent py-3 -mx-6 -mt-6 mb-4 border-b-4 border-cyan-500/50 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              You pulled these cards!
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
              {pulledCards.map((card, index) => (
                <div key={index} className="relative animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                  <Card className="overflow-hidden border-2 border-cyan-500/30 bg-slate-800/50 backdrop-blur-sm hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all">
                    <div className="relative">
                      <img
                        src={card.images?.large || card.images?.small || '/placeholder.png'}
                        alt={card.name}
                        className="w-full h-auto"
                      />
                      {/* NEW Badge only on cards not already owned */}
                      {card.isNewCard && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-2 border-yellow-300 text-xs font-bold px-2 py-1 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-pulse">
                          NEW
                        </Badge>
                      )}
                      {card.isReverseHolo && (
                        <Badge className="absolute top-2 right-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white border border-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                          Reverse Holo!
                        </Badge>
                      )}
                      <Badge className={`absolute bottom-2 left-2 border-2 border-cyan-500/50 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                        {card.rarity || 'Common'}
                      </Badge>
                    </div>
                  </Card>
                  <p className="text-center mt-2 font-bold text-sm text-cyan-100">{card.name}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-center pt-4 border-t-2 border-cyan-500/30">
            <Button onClick={closePackResults} size="lg" className="bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all">
              Add to Collection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Card View Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-2xl border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <div className="flex flex-col items-center">
            <img
              src={selectedCard?.images?.large || selectedCard?.images?.small || '/placeholder.png'}
              alt={selectedCard?.name}
              className="w-full max-w-md h-auto rounded-lg border-4 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.5)]"
            />
            <div className="mt-6 text-center space-y-2">
              <h3 className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">{selectedCard?.name}</h3>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Badge className={`${getRarityColor(selectedCard?.rarity)} border-2 border-cyan-500/50 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]`}>
                  {selectedCard?.rarity || 'Common'}
                </Badge>
                {selectedCard?.isReverseHolo && (
                  <Badge className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-2 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                    Reverse Holo
                  </Badge>
                )}
                {selectedCard?.set && (
                  <Badge className="bg-slate-800 text-cyan-400 border-2 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    {selectedCard.set.name}
                  </Badge>
                )}
                {selectedCard?.count > 1 && (
                  <Badge className="bg-cyan-500 text-black border-2 border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                    x{selectedCard.count} Owned
                  </Badge>
                )}
              </div>
              {selectedCard?.hp && (
                <p className="text-lg font-semibold text-cyan-100">HP: {selectedCard.hp}</p>
              )}
              <p className="text-md text-cyan-100/70 font-medium">
                Type: {getCardType(selectedCard)}
              </p>
            </div>
            <Button 
              onClick={() => setSelectedCard(null)} 
              className="mt-6 bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Achievement Notification Dialog */}
      <Dialog open={showAchievementDialog} onOpenChange={setShowAchievementDialog}>
        <DialogContent className="max-w-md border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
              🎉 Achievement Unlocked! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <Sparkles className="h-20 w-20 text-cyan-400 animate-pulse drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
            {earnedAchievements && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-lg font-bold text-cyan-100">
                    {earnedAchievements.uniqueCount} / {earnedAchievements.totalCards} Cards
                  </p>
                  <p className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                    +{earnedAchievements.bonusPoints} Bonus Points!
                  </p>
                </div>
                <div className="w-full space-y-2">
                  {earnedAchievements.newAchievements?.map((achievement, index) => (
                    <div key={index} className="bg-slate-800/50 border-2 border-cyan-500/30 rounded-lg p-3 text-center">
                      <p className="text-white font-semibold text-sm">
                        Obtained {achievement.threshold} unique cards from {achievement.setName}
                      </p>
                      <p className="text-cyan-400 text-sm font-bold mt-1">+{achievement.reward} points</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Button 
              onClick={() => {
                setShowAchievementDialog(false);
                setEarnedAchievements(null);
              }} 
              className="bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all"
            >
              Awesome!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Preview Dialog */}
      <Dialog open={!!previewSet} onOpenChange={closePreview}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
              {previewSet?.name} - All Cards
            </DialogTitle>
            <p className="text-center text-cyan-100/70 font-medium mt-2">
              {previewCards.length} cards available in this set
            </p>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {previewCards.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Package className="h-20 w-20 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
                {previewCards.map((card) => (
                  <Card 
                    key={card.id} 
                    className="overflow-hidden hover:scale-105 transition-transform bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer"
                    onClick={() => setSelectedCard(card)}
                  >
                    <div className="relative">
                      <img
                        src={card.images?.small || '/placeholder.png'}
                        alt={card.name}
                        className="w-full h-auto"
                      />
                      <Badge className={`absolute bottom-1 left-1 border border-cyan-500/50 text-[10px] shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                        {card.rarity || 'Common'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-center pt-4 border-t-2 border-cyan-500/30">
            <Button 
              onClick={closePreview} 
              className="bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}