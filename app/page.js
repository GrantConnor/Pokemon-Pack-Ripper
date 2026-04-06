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
import Link from 'next/link';

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
  const [pendingRevealId, setPendingRevealId] = useState(null);
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

  // Friends & Trading state
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendMessage, setFriendMessage] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeFriend, setTradeFriend] = useState(null);
  const [selectedTradeCards, setSelectedTradeCards] = useState([]);
  const [activeTrade, setActiveTrade] = useState(null);
  const [selectedResponseCards, setSelectedResponseCards] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tradeSearchWant, setTradeSearchWant] = useState('');
  const [tradeSearchOffer, setTradeSearchOffer] = useState('');
  const [viewingFriend, setViewingFriend] = useState(null);
  const [viewingFriendCollection, setViewingFriendCollection] = useState([]);
  const [breakdownMode, setBreakdownMode] = useState(false);
  const [selectedForBreakdown, setSelectedForBreakdown] = useState([]);
  const [showBreakdownQuantityModal, setShowBreakdownQuantityModal] = useState(false);
  const [breakdownQuantityCard, setBreakdownQuantityCard] = useState(null);
  const [breakdownQuantity, setBreakdownQuantity] = useState(1);
  const [isDissolving, setIsDissolving] = useState(false);

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
          } else if (data.transient) {
            console.error('Transient session error on home page:', data.error);
          } else {
            localStorage.removeItem('userId');
          }
        })
        .catch(err => {
          console.error('Session fetch failed on home page:', err);
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
                return prev;
              })
              .catch(err => {
                console.error('Countdown session refresh failed:', err);
                return prev;
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
    if (!user) return;

    let cancelled = false;

    const bootstrapUserData = async () => {
      try {
        await loadSets();
        if (cancelled) return;

        await loadCollection();
        if (cancelled) return;

        await loadFriends();
        if (cancelled) return;

<<<<<<< HEAD
        await recoverPendingPackReveal(user.id);
        if (cancelled) return;

=======
>>>>>>> 509c79ab0205b2347d5ee7747aef1c4f1d66aed6
        if (user.username === 'Spheal') {
          await loadAllUsers();
        }
      } catch (error) {
        console.error('[BOOTSTRAP] Failed loading post-login data', {
          userId: user.id,
          username: user.username,
          message: error?.message,
        });
      }
    };

    bootstrapUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username]);

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
      // Rarity order from LEAST rare to MOST rare
      const rarityOrder = { 
        'Common': 1, 
        'Uncommon': 2, 
        'Rare': 3, 
        'Rare Holo': 4,
        'Double Rare': 5,
        'Illustration Rare': 6,
        'Ultra Rare': 7,
        'Rare Ultra': 7,
        'Rare Rainbow': 7,
        'Special Illustration Rare': 8,
        'Hyper Rare': 9,
        'Rare Secret': 9,
        'Secret Rare': 9
      };
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

  const loadFriends = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/friends?userId=${user.id}`);
      const data = await response.json();
      setFriends(data.friends || []);
      setPendingRequests(data.pendingRequests || []);
      setSentRequests(data.sentRequests || []);
      setTradeRequests(data.tradeRequests || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setFriendMessage('');
    
    try {
      const response = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUsername: friendUsername })
      });

      const data = await response.json();

      if (response.ok) {
        setFriendMessage(`✅ ${data.message}`);
        setFriendUsername('');
        loadFriends();
      } else {
        setFriendMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setFriendMessage('❌ An error occurred');
    }
  };

  const handleAcceptFriend = async (friendId) => {
    try {
      await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, friendId })
      });
      loadFriends();
    } catch (err) {
      console.error('Error accepting friend:', err);
    }
  };

  const handleDeclineFriend = async (friendId) => {
    try {
      await fetch('/api/friends/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, friendId })
      });
      loadFriends();
    } catch (err) {
      console.error('Error declining friend:', err);
    }
  };

  const handleOpenTradeModal = async (friend) => {
    setTradeFriend(friend);
    setSelectedTradeCards([]);
    setSelectedResponseCards([]);
    setShowTradeModal(true); // Open modal first
    
    // Load friend's collection
    try {
      const response = await fetch(`/api/collection?userId=${friend.id}`);
      const data = await response.json();
      setTradeFriend({ ...friend, collection: data.collection || [] });
    } catch (err) {
      console.error('Error loading friend collection:', err);
      setTradeFriend({ ...friend, collection: [] });
    }
  };

  const toggleTradeCard = (card) => {
    if (selectedTradeCards.find(c => c.id === card.id && c.pulledAt === card.pulledAt)) {
      setSelectedTradeCards(selectedTradeCards.filter(c => !(c.id === card.id && c.pulledAt === card.pulledAt)));
    } else if (selectedTradeCards.length < 10) {
      setSelectedTradeCards([...selectedTradeCards, card]);
    }
  };

  const toggleRequestCard = (card) => {
    if (selectedResponseCards.find(c => c.id === card.id && c.pulledAt === card.pulledAt)) {
      setSelectedResponseCards(selectedResponseCards.filter(c => !(c.id === card.id && c.pulledAt === card.pulledAt)));
    } else if (selectedResponseCards.length < 10) {
      setSelectedResponseCards([...selectedResponseCards, card]);
    }
  };

  const handleSendTrade = async () => {
    if (selectedTradeCards.length === 0) {
      alert('Please select at least 1 card to offer');
      return;
    }

    // Allow free gifts (0 requested cards), but show confirmation
    if (selectedResponseCards.length === 0) {
      if (!window.confirm(`You're giving ${selectedTradeCards.length} card(s) for FREE. Continue?`)) {
        return;
      }
    }

    try {
      const response = await fetch('/api/trades/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          friendId: tradeFriend.id,
          offeredCards: selectedTradeCards,
          requestedCards: selectedResponseCards
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setShowTradeModal(false);
        setSelectedTradeCards([]);
        setSelectedResponseCards([]);
        setTradeSearchWant('');
        setTradeSearchOffer('');
        loadFriends();
        loadCollection();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error sending trade');
    }
  };

  const handleViewTrade = (trade) => {
    setActiveTrade(trade);
  };

  const handleAcceptTrade = async () => {
    try {
      const response = await fetch('/api/trades/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tradeId: activeTrade.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setActiveTrade(null);
        loadFriends();
        loadCollection();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error accepting trade');
    }
  };

  const handleDeclineTrade = async (tradeId) => {
    try {
      await fetch('/api/trades/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tradeId })
      });
      setActiveTrade(null);
      loadFriends();
    } catch (err) {
      console.error('Error declining trade:', err);
    }
  };

  const handleViewFriendProfile = async (friend) => {
    setViewingFriend(friend);
    
    // Load friend's collection
    try {
      const response = await fetch(`/api/collection?userId=${friend.id}`);
      const data = await response.json();
      setViewingFriendCollection(data.collection || []);
    } catch (err) {
      console.error('Error loading friend collection:', err);
      setViewingFriendCollection([]);
    }
  };

  const toggleBreakdownCard = (card) => {
    // If card has multiple copies, show quantity modal
    if (card.count > 1) {
      setBreakdownQuantityCard(card);
      setBreakdownQuantity(1);
      setShowBreakdownQuantityModal(true);
      return;
    }
    
    // Single copy - toggle selection as before
    const isSelected = selectedForBreakdown.find(c => c.id === card.id && c.pulledAt === card.pulledAt);
    if (isSelected) {
      setSelectedForBreakdown(selectedForBreakdown.filter(c => !(c.id === card.id && c.pulledAt === card.pulledAt)));
    } else {
      setSelectedForBreakdown([...selectedForBreakdown, card]);
    }
  };

  const calculateBreakdownPoints = () => {
    const breakdownValues = {
      'Common': 10,
      'Uncommon': 20,
      'Rare': 50,
      'Rare Holo': 50,
      'Double Rare': 100,
      'Illustration Rare': 200,
      'Ultra Rare': 200,
      'Rare Ultra': 200,
      'Rare Rainbow': 200,
      'Special Illustration Rare': 400,
      'Hyper Rare': 500,
      'Rare Secret': 500,
      'Secret Rare': 500
    };
    
    return selectedForBreakdown.reduce((total, card) => {
      return total + (breakdownValues[card.rarity] || 10);
    }, 0);
  };

  const handleBreakdownCards = async () => {
    if (selectedForBreakdown.length === 0) {
      alert('Please select cards to break down');
      return;
    }

    const pointsToGain = calculateBreakdownPoints();
    
    if (!window.confirm(`Break down ${selectedForBreakdown.length} card(s) for ${pointsToGain} points? This cannot be undone!`)) {
      return;
    }

    try {
      const response = await fetch('/api/cards/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, cards: selectedForBreakdown })
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Successfully broke down ${data.cardsBreakdown} cards for ${data.pointsAwarded} points!`);
        setSelectedForBreakdown([]);
        setBreakdownMode(false);
        loadCollection();
        // Update user points
        setUser(prev => ({ ...prev, points: prev.points + data.pointsAwarded }));
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error breaking down cards');
    }
  };

  const handleBreakdownSingleCard = async () => {
    if (!breakdownQuantityCard || breakdownQuantity < 1) {
      return;
    }

    // Play dissolving animation
    setIsDissolving(true);

    // Wait for animation to complete (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const breakdownValues = {
        'Common': 10,
        'Uncommon': 20,
        'Rare': 50,
        'Rare Holo': 50,
        'Double Rare': 100,
        'Illustration Rare': 200,
        'Ultra Rare': 200,
        'Rare Ultra': 200,
        'Rare Rainbow': 200,
        'Special Illustration Rare': 400,
        'Hyper Rare': 500,
        'Rare Secret': 500,
        'Secret Rare': 500
      };

      const pointValue = breakdownValues[breakdownQuantityCard.rarity] || 10;
      const totalPoints = pointValue * breakdownQuantity;

      const response = await fetch('/api/cards/breakdown-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          cardId: breakdownQuantityCard.id,
          amount: breakdownQuantity
        })
      });

      const data = await response.json();
      if (response.ok) {
        // Update user points
        setUser(prev => ({ ...prev, points: prev.points + data.pointsAwarded }));
        loadCollection();
        
        // Close modal and reset
        setShowBreakdownQuantityModal(false);
        setBreakdownQuantityCard(null);
        setBreakdownQuantity(1);
        setIsDissolving(false);
      } else {
        alert(data.error);
        setIsDissolving(false);
      }
    } catch (err) {
      alert('Error breaking down card');
      setIsDissolving(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const authAttempt = {
      action: 'signup',
      username,
      usernameLength: username.length,
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    };
    console.log('[AUTH][CLIENT] Starting signup', authAttempt);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const rawText = await response.text();
      let data = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        console.error('[AUTH][CLIENT] Signup response was not valid JSON', {
          ...authAttempt,
          status: response.status,
          rawText,
          parseError: parseError?.message,
        });
        throw new Error('Server returned a non-JSON response during signup');
      }

      console.log('[AUTH][CLIENT] Signup response received', {
        ...authAttempt,
        status: response.status,
        ok: response.ok,
        authTraceId: data.authTraceId || null,
        error: data.error || null,
      });

      if (response.ok) {
        localStorage.setItem('userId', data.user.id);
        setUser(data.user);
        setCountdown(data.user.nextPointsIn || 0);
        setUsername('');
        setPassword('');
      } else {
        setError(data.authTraceId ? `${data.error || 'Sign up failed'} (Ref: ${data.authTraceId})` : (data.error || 'Sign up failed'));
      }
    } catch (err) {
      console.error('[AUTH][CLIENT] Signup failed with exception', {
        ...authAttempt,
        message: err?.message,
        stack: err?.stack,
      });
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const authAttempt = {
      action: 'signin',
      username,
      usernameLength: username.length,
      passwordLength: password.length,
      timestamp: new Date().toISOString(),
    };
    console.log('[AUTH][CLIENT] Starting signin', authAttempt);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const rawText = await response.text();
      let data = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        console.error('[AUTH][CLIENT] Signin response was not valid JSON', {
          ...authAttempt,
          status: response.status,
          rawText,
          parseError: parseError?.message,
        });
        throw new Error('Server returned a non-JSON response during signin');
      }

      console.log('[AUTH][CLIENT] Signin response received', {
        ...authAttempt,
        status: response.status,
        ok: response.ok,
        authTraceId: data.authTraceId || null,
        error: data.error || null,
      });

      if (response.ok) {
        localStorage.setItem('userId', data.user.id);
        setUser(data.user);
        setCountdown(data.user.nextPointsIn || 0);
        setUsername('');
        setPassword('');
      } else {
        setError(data.authTraceId ? `${data.error || 'Sign in failed'} (Ref: ${data.authTraceId})` : (data.error || 'Sign in failed'));
      }
    } catch (err) {
      console.error('[AUTH][CLIENT] Signin failed with exception', {
        ...authAttempt,
        message: err?.message,
        stack: err?.stack,
      });
      setError(err?.message || 'An error occurred. Please try again.');
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
  const [adminDeleteUser, setAdminDeleteUser] = useState('');

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

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    setAdminMessage('');
    
    if (!adminDeleteUser) {
      setAdminMessage('Please enter a username');
      return;
    }

    if (adminDeleteUser.toLowerCase() === 'spheal') {
      setAdminMessage('❌ Cannot delete admin account');
      return;
    }

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId: user.id, 
          targetUsername: adminDeleteUser
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAdminMessage(`✅ User "${adminDeleteUser}" permanently deleted`);
        setAdminDeleteUser('');
        // Refresh user list
        loadAllUsers();
      } else {
        setAdminMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setAdminMessage('❌ An error occurred. Please try again.');
    }
  };



  const hydrateRevealIntoUi = (revealData) => {
    if (!revealData) return;

    const ownedCardIds = new Set(collection.map(c => c.id));

    if (revealData.isBulk && revealData.packs) {
      const packsWithNewFlags = revealData.packs.map(pack => ({
        ...pack,
        cards: pack.cards.map(card => ({
          ...card,
          isNewCard: !ownedCardIds.has(card.id)
        }))
      }));
      setPulledCards(packsWithNewFlags);
    } else {
      const cardsWithNewFlag = (revealData.cards || []).map(card => ({
        ...card,
        isNewCard: !ownedCardIds.has(card.id)
      }));
      setPulledCards([{ packNumber: 1, cards: cardsWithNewFlag }]);
    }

    setPendingRevealId(revealData.revealId || revealData.id || null);
    if (revealData.pointsRemaining !== undefined) {
      setUser(prev => prev ? ({ ...prev, points: revealData.pointsRemaining }) : prev);
    }
  };

  const recoverPendingPackReveal = async (targetUserId = user?.id) => {
    if (!targetUserId) return false;

    try {
      const response = await fetch(`/api/packs/pending?userId=${targetUserId}`);
      const data = await response.json();

      if (response.ok && data.reveal) {
        hydrateRevealIntoUi(data.reveal);
        setShowPackAnimation(false);
        return true;
      }
    } catch (error) {
      console.error('Failed to recover pending pack reveal:', error);
    }

    return false;
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
          hydrateRevealIntoUi(data);
          setShowPackAnimation(false);
          
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
      const recovered = await recoverPendingPackReveal(user?.id);
      if (!recovered) {
        setError('An error occurred. Please try again.');
        setShowPackAnimation(false);
      }
    } finally {
      setOpeningPack(false);
    }
  };

  const closePackResults = async () => {
    const revealIdToClaim = pendingRevealId;

    setPulledCards([]);
    setPendingRevealId(null);
    setSelectedSet(null);

    if (revealIdToClaim && user?.id) {
      try {
        await fetch('/api/packs/pending/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, revealId: revealIdToClaim })
        });
      } catch (error) {
        console.error('Failed to mark pack reveal as claimed:', error);
      }
    }
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
            <Link href="/wilds">
              <Button className="bg-green-600 hover:bg-green-500 border-2 border-green-400 font-bold shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                Pokemon Wilds
              </Button>
            </Link>
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

            {/* Delete User Command */}
            <div className="border-t border-red-500/30 pt-4">
              <h4 className="text-sm font-semibold text-red-200 mb-2">⚠️ DELETE User Permanently</h4>
              <form onSubmit={handleDeleteUser} className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Username to DELETE"
                    value={adminDeleteUser}
                    onChange={(e) => setAdminDeleteUser(e.target.value)}
                    className="border-2 border-red-600/50 bg-slate-800/50 text-white placeholder:text-slate-400 font-medium focus:border-red-600"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  className="bg-red-700 text-white hover:bg-red-600 border-2 border-red-600 font-bold shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] transition-all"
                >
                  ⚠️ DELETE User
                </Button>
              </form>
              <p className="text-xs text-red-300 mt-1">Warning: This permanently deletes the user and ALL their data!</p>
            </div>

            {adminMessage && (
              <p className={`mt-3 text-sm font-medium ${adminMessage.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {adminMessage}
              </p>
            )}

            {/* All Users List */}
            {allUsers.length > 0 && (
              <div className="border-t border-purple-500/30 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-purple-200 mb-2">👥 All Registered Users ({allUsers.length})</h4>
                <ScrollArea className="h-40 border border-purple-500/20 rounded-lg bg-slate-900/50 p-2">
                  <div className="space-y-1">
                    {allUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between py-1 px-2 hover:bg-purple-500/10 rounded text-xs">
                        <span className="text-purple-100">{u.username}</span>
                        <span className="text-purple-300">{u.points} pts</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="container mx-auto px-4 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-6 bg-slate-800/50 backdrop-blur-sm h-12 border-2 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <TabsTrigger value="packs" className="flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Package className="h-4 w-4" />
              Open Packs
            </TabsTrigger>
            <TabsTrigger value="collection" className="flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Library className="h-4 w-4" />
              My Collection
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Users className="h-4 w-4" />
              Friends
            </TabsTrigger>
          </TabsList>

          {/* Open Packs Tab */}
          <TabsContent value="packs" className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-2">Choose Your Pack</h2>
              <p className="text-cyan-100/70 font-medium">Select a Pokemon TCG set to open a booster pack</p>
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
                    const packPrice = set.packPrice || 100;
                    const bulkPrice = set.bulkPrice || 1000;
                    const canAfford = user.points >= packPrice || user.username === 'Spheal';
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
                                  Open Pack ({packPrice})
                                </>
                              ) : (
                                'Not Enough Points'
                              )}
                            </Button>
                            <Button 
                              className={`w-full font-bold border-2 transition-all text-sm ${
                                (user.points >= bulkPrice || user.username === 'Spheal')
                                  ? 'bg-purple-500 text-white hover:bg-purple-400 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_25px_rgba(168,85,247,0.8)]' 
                                  : 'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                              onClick={() => handleOpenPack(set, true)}
                              disabled={openingPack || (user.points < bulkPrice && user.username !== 'Spheal')}
                            >
                              {(user.points >= bulkPrice || user.username === 'Spheal') ? (
                                <>
                                  <Package className="h-4 w-4 mr-2" />
                                  Open 10 Packs ({bulkPrice})
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

            {/* Breakdown Mode Toggle */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => {
                  setBreakdownMode(!breakdownMode);
                  setSelectedForBreakdown([]);
                }}
                className={breakdownMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600 hover:bg-red-500 text-white font-bold'}
              >
                {breakdownMode ? 'Cancel Breakdown' : 'Breakdown Mode'}
              </Button>
            </div>

            {/* Breakdown Action Bar */}
            {breakdownMode && (
              <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 border-2 border-orange-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 font-bold">Breakdown Mode Active</p>
                    <p className="text-sm text-orange-100/70">
                      Selected: {selectedForBreakdown.length} cards = {calculateBreakdownPoints()} points
                    </p>
                  </div>
                  <Button
                    onClick={handleBreakdownCards}
                    disabled={selectedForBreakdown.length === 0}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold"
                  >
                    Break Down Cards
                  </Button>
                </div>
              </div>
            )}

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
                  groupedAndSortedCollection.map((card) => {
                    const isSelectedForBreakdown = breakdownMode && selectedForBreakdown.find(c => c.id === card.id && c.pulledAt === card.pulledAt);
                    return (
                      <Card 
                        key={card.id} 
                        className={`overflow-visible hover:scale-110 hover:z-50 transition-transform bg-slate-800/50 backdrop-blur-sm border-2 ${
                          isSelectedForBreakdown 
                            ? 'border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]' 
                            : 'border-cyan-500/30 hover:border-cyan-500 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                        } cursor-pointer relative`}
                        onClick={() => breakdownMode ? toggleBreakdownCard(card) : handleCardClick(card)}
                      >
                        <div className="relative">
                          <img
                            src={card.images?.small || '/placeholder.png'}
                            alt={card.name}
                            className="w-full h-auto rounded-t"
                          />
                          {/* Breakdown Selected Indicator */}
                          {isSelectedForBreakdown && (
                            <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                              <Check className="h-12 w-12 text-white drop-shadow-lg" />
                            </div>
                          )}
                          {/* NEW Badge */}
                          {!breakdownMode && isCardNew(card) && (
                            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-2 border-yellow-300 text-xs font-bold px-2 py-1 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-pulse">
                              NEW
                            </Badge>
                          )}
                          {/* Count Badge */}
                          {!breakdownMode && card.count > 1 && (
                            <Badge className={`absolute ${isCardNew(card) ? 'top-10' : 'top-2'} left-2 bg-cyan-500 text-black border-2 border-cyan-400 text-lg font-bold px-2 py-1 shadow-[0_0_15px_rgba(6,182,212,0.6)]`}>
                              x{card.count}
                            </Badge>
                          )}
                          {!breakdownMode && card.isReverseHolo && (
                            <Badge className="absolute top-2 right-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white border border-cyan-300 text-xs shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                              Reverse
                            </Badge>
                          )}
                          <Badge className={`absolute bottom-2 left-2 border-2 border-cyan-500/50 text-xs shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                            {card.rarity || 'Common'}
                          </Badge>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-2">Friends & Trading</h2>
              <p className="text-cyan-100/70 font-medium">Add friends and trade Pokemon cards!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Add Friend */}
              <Card className="border-2 border-cyan-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Add Friend</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddFriend} className="space-y-3">
                    <Input
                      placeholder="Username"
                      value={friendUsername}
                      onChange={(e) => setFriendUsername(e.target.value)}
                      className="border-2 border-cyan-500/30 bg-slate-700/50 text-white"
                      required
                    />
                    <Button type="submit" className="w-full bg-cyan-500 text-black hover:bg-cyan-400">
                      <Send className="h-4 w-4 mr-2" />
                      Send Request
                    </Button>
                  </form>
                  {friendMessage && (
                    <p className={`mt-2 text-sm ${friendMessage.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                      {friendMessage}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Friends List */}
              <Card className="border-2 border-cyan-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <CardHeader>
                  <CardTitle className="text-cyan-400">My Friends ({friends.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {friends.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No friends yet</p>
                    ) : (
                      <div className="space-y-2">
                        {friends.map((friend) => (
                          <div 
                            key={friend.id} 
                            className="flex items-center justify-between p-2 bg-slate-700/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-cyan-400" />
                              <div>
                                <p className="text-white font-medium">{friend.username}</p>
                                <p className="text-xs text-cyan-400">{friend.tradesCompleted || 0} trades completed</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTradeModal(friend);
                              }}
                              className="bg-purple-500 text-white hover:bg-purple-400 text-xs"
                            >
                              Trade
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Pending Requests */}
              <Card className="border-2 border-yellow-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <CardHeader>
                  <CardTitle className="text-yellow-400">Friend Requests ({pendingRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {pendingRequests.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No pending requests</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingRequests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                            <span className="text-white">{req.username}</span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleAcceptFriend(req.id)}
                                className="bg-green-500 text-white hover:bg-green-400"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeclineFriend(req.id)}
                                className="bg-red-500 text-white hover:bg-red-400"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Trade Requests */}
              <Card className="border-2 border-purple-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                <CardHeader>
                  <CardTitle className="text-purple-400">Trade Requests ({tradeRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {tradeRequests.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No trade requests</p>
                    ) : (
                      <div className="space-y-2">
                        {tradeRequests.map((trade) => (
                          <div key={trade.id} className="p-2 bg-slate-700/50 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white font-semibold">{trade.fromUsername}</span>
                              <Badge className="bg-purple-500">
                                {trade.type === 'pokemon-trade' 
                                  ? `${trade.offeredPokemon?.length || 0} Pokemon` 
                                  : `${trade.offeredCards?.length || 0} cards`}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleViewTrade(trade)}
                              className="w-full bg-purple-500 text-white hover:bg-purple-400"
                            >
                              View Trade
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
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
      <Dialog open={pulledCards.length > 0} onOpenChange={(open) => { if (!open) closePackResults(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white bg-gradient-to-r from-cyan-500/20 to-transparent py-3 -mx-6 -mt-6 mb-4 border-b-4 border-cyan-500/50 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              {pulledCards.length > 1 ? `Opened ${pulledCards.length} Packs!` : 'You pulled these cards!'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-4">
              {pulledCards.map((pack, packIndex) => (
                <div key={packIndex} className="space-y-3">
                  {pulledCards.length > 1 && (
                    <h3 className="text-lg font-bold text-cyan-400 border-b border-cyan-500/30 pb-2">
                      Pack #{pack.packNumber}
                    </h3>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {pack.cards.map((card, cardIndex) => (
                      <div key={cardIndex} className="relative animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${cardIndex * 50}ms` }}>
                        <Card className="overflow-hidden border-2 border-cyan-500/30 bg-slate-800/50 backdrop-blur-sm hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all">
                          <div className="relative">
                            <img
                              src={card.images?.small || '/placeholder.png'}
                              alt={card.name}
                              className="w-full h-auto"
                            />
                            {/* NEW Badge only on cards not already owned */}
                            {card.isNewCard && (
                              <Badge className="absolute top-1 left-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-2 border-yellow-300 text-xs font-bold px-1.5 py-0.5 shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-pulse">
                                NEW
                              </Badge>
                            )}
                            {card.isReverseHolo && (
                              <Badge className="absolute top-1 right-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white border border-cyan-300 text-xs font-bold px-1.5 py-0.5 shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                                RH
                              </Badge>
                            )}
                            <Badge className={`absolute bottom-1 left-1 border border-cyan-500/50 text-xs px-1.5 py-0.5 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                              {card.rarity?.split(' ')[0] || 'Common'}
                            </Badge>
                          </div>
                        </Card>
                        <p className="text-center mt-1 text-xs text-cyan-100 truncate">{card.name}</p>
                      </div>
                    ))}
                  </div>
                  {packIndex < pulledCards.length - 1 && (
                    <div className="border-t-2 border-cyan-500/20 pt-2"></div>
                  )}
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


      {/* Trade Modal - Send Trade */}
      <Dialog open={showTradeModal} onOpenChange={setShowTradeModal}>
        <DialogContent className="max-w-7xl max-h-[90vh] border-4 border-purple-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Trade with {tradeFriend?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            {/* Left: What you WANT from their collection */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-cyan-400">
                What you want ({selectedResponseCards.length}/10)
              </h3>
              <p className="text-xs text-cyan-100/70">Browse {tradeFriend?.username}'s collection (optional - leave empty for free gift)</p>
              
              {/* Search bar for their collection */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-cyan-400" />
                <Input
                  placeholder="Search their cards..."
                  value={tradeSearchWant}
                  onChange={(e) => setTradeSearchWant(e.target.value)}
                  className="pl-8 border-2 border-cyan-500/30 bg-slate-700/50 text-white text-sm"
                />
              </div>

              <ScrollArea className="h-96 border-2 border-cyan-500/30 rounded p-2 bg-slate-800/30">
                {!tradeFriend?.collection ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                      <p className="text-cyan-100/70">Loading collection...</p>
                    </div>
                  </div>
                ) : tradeFriend.collection.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {tradeFriend.collection
                      .filter(card => !tradeSearchWant || card.name.toLowerCase().includes(tradeSearchWant.toLowerCase()))
                      .map((card, index) => {
                        const isSelected = selectedResponseCards.find(c => c.id === card.id && c.pulledAt === card.pulledAt);
                        return (
                          <Card
                            key={index}
                            onClick={() => toggleRequestCard(card)}
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-4 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)]' 
                                : 'border-2 border-cyan-500/30 hover:border-cyan-500'
                            }`}
                          >
                            <div className="relative">
                              <img src={card.images?.small} alt={card.name} className="w-full" />
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-cyan-500 rounded-full p-1">
                                  <Check className="h-4 w-4 text-black" />
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-center text-cyan-100/50 py-8">No cards in collection</p>
                )}
              </ScrollArea>
            </div>

            {/* Right: What you're OFFERING from your collection */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-purple-400">
                What you're offering ({selectedTradeCards.length}/10)
              </h3>
              <p className="text-xs text-purple-100/70">Select from your collection (required)</p>
              
              {/* Search bar for your collection */}
              <div className="relative">


      {/* Friend Profile Modal */}
      <Dialog open={!!viewingFriend} onOpenChange={() => setViewingFriend(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
              <Users className="h-6 w-6" />
              {viewingFriend?.username}'s Profile
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-2 border-cyan-500/30 bg-slate-800/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-4xl font-bold text-cyan-400">{viewingFriendCollection.length}</p>
                  <p className="text-sm text-cyan-100/70">Cards Owned</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-purple-500/30 bg-slate-800/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-4xl font-bold text-purple-400">{viewingFriend?.tradesCompleted || 0}</p>
                  <p className="text-sm text-purple-100/70">Trades Completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Collection */}
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Collection</h3>
              <ScrollArea className="h-96 border-2 border-cyan-500/30 rounded p-4 bg-slate-800/30">
                {viewingFriendCollection.length === 0 ? (
                  <p className="text-center text-cyan-100/50 py-8">No cards yet</p>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {viewingFriendCollection.map((card, index) => (
                      <Card key={index} className="border-2 border-cyan-500/30 overflow-hidden">
                        <img src={card.images?.small} alt={card.name} className="w-full" />
                        <div className="p-1 bg-slate-900/50">
                          <p className="text-xs text-white text-center truncate">{card.name}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-cyan-500/30">
              <Button 
                onClick={() => setViewingFriend(null)}
                variant="outline"
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  handleOpenTradeModal(viewingFriend);
                  setViewingFriend(null);
                }}
                className="bg-purple-500 text-white hover:bg-purple-400"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Trade Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trade View Modal - Accept/Decline Trade */}
                <Input
                  placeholder="Search your cards..."
                  value={tradeSearchOffer}
                  onChange={(e) => setTradeSearchOffer(e.target.value)}
                  className="pl-8 border-2 border-purple-500/30 bg-slate-700/50 text-white text-sm"
                />
              </div>

              <ScrollArea className="h-96 border-2 border-purple-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {groupedAndSortedCollection
                    .filter(card => !tradeSearchOffer || card.name.toLowerCase().includes(tradeSearchOffer.toLowerCase()))
                    .map((card, index) => {
                      const isSelected = selectedTradeCards.find(c => c.id === card.id && c.pulledAt === card.pulledAt);
                      return (
                        <Card
                          key={index}
                          onClick={() => toggleTradeCard(card)}
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-4 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.8)]' 
                              : 'border-2 border-purple-500/30 hover:border-purple-500'
                          }`}
                        >
                          <div className="relative">
                            <img src={card.images?.small} alt={card.name} className="w-full" />
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-1">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-purple-500/30">
            <p className="text-sm text-cyan-100/70">
              {selectedResponseCards.length === 0 ? (
                <span className="text-yellow-400">FREE GIFT: Giving {selectedTradeCards.length} card(s) for nothing</span>
              ) : (
                `Trading ${selectedTradeCards.length} cards for ${selectedResponseCards.length} cards`
              )}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowTradeModal(false)} variant="outline">
                Cancel
              </Button>
              <Button 
                onClick={handleSendTrade}
                disabled={selectedTradeCards.length === 0}
                className="bg-purple-500 text-white hover:bg-purple-400"
              >
                Send Trade Offer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trade View Modal - Accept/Decline Trade */}
      <Dialog open={!!activeTrade} onOpenChange={() => setActiveTrade(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-4 border-purple-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Trade Request from {activeTrade?.fromUsername}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            {/* Left: What they're offering you */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-green-400">
                They're giving you: ({activeTrade?.offeredCards?.length || 0} cards)
              </h3>
              <ScrollArea className="h-96 border-2 border-green-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activeTrade?.offeredCards.map((card, index) => (
                    <Card key={index} className="border-2 border-green-500/30">
                      <img src={card.images?.small} alt={card.name} className="w-full" />
                      <p className="text-xs text-center text-white p-1 bg-slate-900/50">{card.name}</p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right: What they want from you */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-red-400">
                They want from you: ({activeTrade?.requestedCards?.length || 0} cards)
              </h3>
              <ScrollArea className="h-96 border-2 border-red-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activeTrade?.requestedCards.map((card, index) => (
                    <Card key={index} className="border-2 border-red-500/30">
                      <img src={card.images?.small} alt={card.name} className="w-full" />
                      <p className="text-xs text-center text-white p-1 bg-slate-900/50">{card.name}</p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-purple-500/30">
            <p className="text-sm text-cyan-100/70">
              {activeTrade?.requestedCards?.length === 0 ? (
                <span className="text-yellow-400 font-semibold">🎁 FREE GIFT: They're giving you {activeTrade?.offeredCards?.length || 0} card(s)!</span>
              ) : (
                `Trade: ${activeTrade?.requestedCards?.length || 0} of your cards for ${activeTrade?.offeredCards?.length || 0} of their cards`
              )}
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => activeTrade && handleDeclineTrade(activeTrade.id)}
                className="bg-red-500 text-white hover:bg-red-400"
              >
                Decline Trade
              </Button>
              <Button 
                onClick={handleAcceptTrade}
                className="bg-green-500 text-white hover:bg-green-400"
              >
                Accept Trade
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Breakdown Quantity Modal */}
      <Dialog open={showBreakdownQuantityModal} onOpenChange={() => {
        if (!isDissolving) {
          setShowBreakdownQuantityModal(false);
          setBreakdownQuantityCard(null);
          setBreakdownQuantity(1);
        }
      }}>
        <DialogContent className="max-w-md border-4 border-red-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-400">
              Break Down Cards
            </DialogTitle>
          </DialogHeader>

          {breakdownQuantityCard && (
            <div className="space-y-6">
              {/* Card Preview with Dissolving Animation */}
              <div className={`relative transition-all duration-1500 ${isDissolving ? 'animate-dissolve' : ''}`}>
                <img
                  src={breakdownQuantityCard.images.small}
                  alt={breakdownQuantityCard.name}
                  className={`w-full rounded-lg border-2 border-red-500/30 ${isDissolving ? 'dissolving-card' : ''}`}
                />
                {isDissolving && (
                  <div className="absolute inset-0 bg-gradient-to-t from-red-600/80 via-orange-500/60 to-transparent rounded-lg animate-pulse"></div>
                )}
              </div>

              {!isDissolving && (
                <>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{breakdownQuantityCard.name}</h3>
                    <p className="text-gray-400">
                      You own <span className="text-cyan-400 font-bold">{breakdownQuantityCard.count}</span> {breakdownQuantityCard.count === 1 ? 'copy' : 'copies'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">How many to break down?</Label>
                    <Input
                      type="number"
                      min="1"
                      max={breakdownQuantityCard.count}
                      value={breakdownQuantity}
                      onChange={(e) => setBreakdownQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), breakdownQuantityCard.count))}
                      className="bg-slate-800 border-red-500/30 text-white"
                    />
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-lg border border-red-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Points per card:</span>
                      <span className="text-yellow-400 font-bold">
                        {(() => {
                          const values = {
                            'Common': 10, 'Uncommon': 20, 'Rare': 50, 'Rare Holo': 50,
                            'Double Rare': 100, 'Illustration Rare': 200, 'Ultra Rare': 200,
                            'Rare Ultra': 200, 'Rare Rainbow': 200, 'Special Illustration Rare': 400,
                            'Hyper Rare': 500, 'Rare Secret': 500, 'Secret Rare': 500
                          };
                          return values[breakdownQuantityCard.rarity] || 10;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-red-500/30">
                      <span className="text-white font-bold">Total points:</span>
                      <span className="text-yellow-400 font-bold text-xl">
                        {(() => {
                          const values = {
                            'Common': 10, 'Uncommon': 20, 'Rare': 50, 'Rare Holo': 50,
                            'Double Rare': 100, 'Illustration Rare': 200, 'Ultra Rare': 200,
                            'Rare Ultra': 200, 'Rare Rainbow': 200, 'Special Illustration Rare': 400,
                            'Hyper Rare': 500, 'Rare Secret': 500, 'Secret Rare': 500
                          };
                          return (values[breakdownQuantityCard.rarity] || 10) * breakdownQuantity;
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowBreakdownQuantityModal(false);
                        setBreakdownQuantityCard(null);
                        setBreakdownQuantity(1);
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-500"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBreakdownSingleCard}
                      className="flex-1 bg-red-600 hover:bg-red-500 font-bold"
                    >
                      Confirm Breakdown
                    </Button>
                  </div>
                </>
              )}

              {isDissolving && (
                <div className="text-center">
                  <p className="text-xl font-bold text-red-400 animate-pulse">
                    Breaking down cards...
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}