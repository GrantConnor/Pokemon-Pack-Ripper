'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Package, Library, LogOut, Coins, Search, Clock, Eye, Users, Send, X, Check, Star } from 'lucide-react';
import Link from 'next/link';
import { getBreakdownValueForRarity } from '@/lib/breakdown-values';


const ALL_KNOWN_RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Rare Holo',
  'Rare Holo EX',
  'Rare Holo V',
  'Rare Holo VMAX',
  'Double Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Ultra Rare',
  'Rare Ultra',
  'Rare Rainbow',
  'Hyper Rare',
  'Secret Rare',
  'Rare Secret',
  'Amazing Rare',
  'Rare BREAK',
  'Rare Prism Star',
  'ACE SPEC Rare',
  'Rare Shiny',
  'Shiny Rare',
  'Radiant Rare',
  'LEGEND',
];

const CACHE_TTL = {
  sets: 24 * 60 * 60 * 1000,
  collection: 5 * 60 * 1000,
  friends: 2 * 60 * 1000,
  previewCards: 24 * 60 * 60 * 1000,
};

function readLocalCache(key, maxAgeMs) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.savedAt || (Date.now() - parsed.savedAt) > maxAgeMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeLocalCache(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {}
}

function clearLocalCache(key) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}

function setsCacheKey() { return 'cache:sets:v2'; }
function collectionCacheKey(userId) { return `cache:collection:${userId}:v1`; }
function friendsCacheKey(userId) { return `cache:friends:${userId}:v1`; }
function previewCardsCacheKey(setId) { return `cache:preview-cards:${setId}:v2`; }

function sortFriendsByOnline(friends = []) {
  return [...friends].sort((a, b) => {
    if (!!a?.isOnline !== !!b?.isOnline) return a?.isOnline ? -1 : 1;
    const aSeen = a?.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bSeen = b?.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    if (aSeen !== bSeen) return bSeen - aSeen;
    return (a?.username || '').localeCompare(b?.username || '');
  });
}

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [wildSpawnAnnouncement, setWildSpawnAnnouncement] = useState(null);
  const [sets, setSets] = useState([]);
  const [setCardCounts, setSetCardCounts] = useState({});
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingPack, setOpeningPack] = useState(false);
  const [pulledCards, setPulledCards] = useState([]);
  const [pendingRevealId, setPendingRevealId] = useState(null);
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const [showPackResults, setShowPackResults] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);
  const [activeTab, setActiveTab] = useState('packs');
  const [selectedCard, setSelectedCard] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [packSearchQuery, setPackSearchQuery] = useState('');
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);
  const [earnedAchievements, setEarnedAchievements] = useState(null);
  const [previewSet, setPreviewSet] = useState(null);
  const [previewCards, setPreviewCards] = useState([]);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [hideOwnedInPreview, setHideOwnedInPreview] = useState(false);
  
  // Collection filters
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [setFilter, setSetFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState(['newest']); // Default to newest

  // Friends & Trading state
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);
  const [socialNotifications, setSocialNotifications] = useState([]);
  const [battleRequests, setBattleRequests] = useState([]);
  const [showDailyObjectives, setShowDailyObjectives] = useState(false);
  const [dailyObjectives, setDailyObjectives] = useState(null);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendMessage, setFriendMessage] = useState('');
  const tradeSoundCountRef = useRef(0);
  const battleSoundCountRef = useRef(0);
  const packOpenTimeoutRef = useRef(null);

  const playTradeNotificationSound = () => {
    try { new Audio('/pokemon-level-up.mp3').play().catch(() => {}); } catch {}
  };

  const playBattleNotificationSound = () => {
    try { new Audio('/alert-meme.mp3').play().catch(() => {}); } catch {}
  };

  const loadDailyObjectives = async (resolvedUserId = user?.id) => {
    if (!resolvedUserId) return;
    try {
      const response = await fetch(`/api/daily-objectives?userId=${resolvedUserId}`);
      const data = await response.json();
      setDailyObjectives(data.dailyObjectives || null);
    } catch (err) {
      console.error('Error loading daily objectives:', err);
    }
  };


  const loadPlayerCard = async (userId) => {
    try {
      const editable = userId === user?.id ? '&editable=1' : '';
      const response = await fetch(`/api/profile/card?userId=${userId}${editable}`);
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load player card');
      }
      if (data.profileCard) {
        setPlayerCard(data.profileCard);
        setShowPlayerCard(true);
      }
    } catch (err) {
      console.error('Error loading player card:', err);
      alert(err.message || 'Failed to load player card');
    }
  };

  const handleSelectFavoriteCard = async (cardId) => {
    if (!user?.id || !cardId) return;
    try {
      const response = await fetch('/api/profile/favorite-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, cardId })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to set favorite card');
      }
      await loadPlayerCard(user.id);
    } catch (err) {
      console.error('Error setting favorite card:', err);
      alert(err.message || 'Failed to set favorite card');
    }
  };

  const handleSelectPlayerTitle = async (titleId) => {
    if (!user?.id || !titleId) return;
    try {
      const response = await fetch('/api/profile/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, titleId })
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Failed to equip title');
        return;
      }
      setUser((prev) => prev ? { ...prev, selectedTitleId: data.selectedTitleId } : prev);
      if (showPlayerCard && playerCard?.id === user.id) {
        loadPlayerCard(user.id);
      }
    } catch (err) {
      console.error('Error selecting title:', err);
      alert('Failed to equip title');
    }
  };
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeFriend, setTradeFriend] = useState(null);
  const [selectedTradeCards, setSelectedTradeCards] = useState([]);
  const [activeTrade, setActiveTrade] = useState(null);
  const [activePokemonTrade, setActivePokemonTrade] = useState(null);
  const [selectedResponseCards, setSelectedResponseCards] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tradeSearchWant, setTradeSearchWant] = useState('');
  const [tradeSearchOffer, setTradeSearchOffer] = useState('');
  const [viewingFriend, setViewingFriend] = useState(null);
  const [viewingFriendCollection, setViewingFriendCollection] = useState([]);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [playerCard, setPlayerCard] = useState(null);
  const [breakdownMode, setBreakdownMode] = useState(false);
  const [breakdownAllMultiples, setBreakdownAllMultiples] = useState(true);
  const [breakdownIncludePremium, setBreakdownIncludePremium] = useState(false);
  const [selectedForBreakdown, setSelectedForBreakdown] = useState([]);
  const [showBreakdownQuantityModal, setShowBreakdownQuantityModal] = useState(false);
  const [breakdownQuantityCard, setBreakdownQuantityCard] = useState(null);
  const [breakdownQuantity, setBreakdownQuantity] = useState(1);
  const [isDissolving, setIsDissolving] = useState(false);

  const unreadSocialCount = pendingRequests.length + tradeRequests.length + (socialNotifications || []).filter((notification) => !notification?.read).length;


  useEffect(() => {
    return () => {
      if (packOpenTimeoutRef.current) {
        clearTimeout(packOpenTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (!user?.id) return;

    const pingPresence = () => {
      fetch('/api/presence/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, includePremium: breakdownIncludePremium })
      }).catch(err => console.error('Presence ping failed on home page:', err));
    };

    pingPresence();
    const interval = setInterval(pingPresence, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadFriends({ forceRefresh: true });
    const interval = setInterval(() => {
      loadFriends({ forceRefresh: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [user?.id]);

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

        await recoverPendingPackReveal(user.id);
        if (cancelled) return;

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


  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const checkWildSpawnAnnouncement = async () => {
      try {
        const response = await fetch('/api/wilds/current');
        const data = await response.json();
        if (!response.ok || !data.spawn || cancelled) return;

        const spawnKey = `${data.spawn.spawnedAt}:${data.spawn.pokemon.id}`;
        const seenKey = 'site:lastWildSpawnSeen';
        const lastSeen = localStorage.getItem(seenKey);

        if (lastSeen && lastSeen !== spawnKey) {
          setWildSpawnAnnouncement({
            key: spawnKey,
            name: data.spawn.pokemon.displayName,
            id: data.spawn.pokemon.id,
          });
        }

        localStorage.setItem(seenKey, spawnKey);
      } catch (error) {
        console.error('Failed checking wild spawn announcement:', error);
      }
    };

    checkWildSpawnAnnouncement();
    const interval = setInterval(checkWildSpawnAnnouncement, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);

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
      filtered = filtered.filter(card => Array.isArray(card.types) && card.types.includes(typeFilter));
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

  const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'set', label: 'Set' },
    { value: 'type', label: 'Type' },
    { value: 'rarity', label: 'Rarity' },
    { value: 'favorites', label: 'Favorites First' },
  ];

  const toggleSortOption = (value) => {
    if (value === 'none') {
      setSortBy([]);
      return;
    }
    setSortBy((prev) => {
      const next = prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value];
      const order = new Map(SORT_OPTIONS.map((option, index) => [option.value, index]));
      return next.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    });
  };

  const groupedAndSortedCollection = useMemo(() => {
    // Group by card ID
    const cardMap = new Map();
    filteredCollection.forEach(card => {
      const key = card.id;
      if (cardMap.has(key)) {
        cardMap.get(key).count++;
        if (card.favorite) {
          cardMap.get(key).favorite = true;
        }
        // Keep the earliest pulled card for "newest" logic
        if (new Date(card.pulledAt) > new Date(cardMap.get(key).pulledAt)) {
          cardMap.get(key).pulledAt = card.pulledAt;
        }
      } else {
        cardMap.set(key, { ...card, count: 1 });
      }
    });

    let grouped = Array.from(cardMap.values());

    const rarityOrder = { 
      'Common': 1, 
      'Uncommon': 2, 
      'Rare': 3, 
      'Rare Holo': 4,
      'Rare Holo EX': 5,
      'Rare Holo V': 6,
      'Rare Holo VMAX': 7,
      'Double Rare': 8,
      'Illustration Rare': 9,
      'Special Illustration Rare': 10,
      'Ultra Rare': 11,
      'Rare Ultra': 12,
      'Rare Rainbow': 13,
      'Hyper Rare': 14,
      'Secret Rare': 15,
      'Rare Secret': 16,
      'Amazing Rare': 17,
      'Rare BREAK': 18,
      'Rare Prism Star': 19,
      'ACE SPEC Rare': 20,
      'Rare Shiny': 21,
      'Shiny Rare': 22,
      'Radiant Rare': 23,
      'LEGEND': 24,
    };

    const selectedSorts = Array.isArray(sortBy) ? sortBy : (sortBy && sortBy !== 'none' ? [sortBy] : []);
    if (selectedSorts.length > 0) {
      grouped.sort((a, b) => {
        for (const sort of selectedSorts) {
          let result = 0;
          if (sort === 'favorites') {
            if (!!b.favorite !== !!a.favorite) {
              result = Number(b.favorite) - Number(a.favorite);
            }
          } else if (sort === 'newest') {
            result = new Date(b.pulledAt) - new Date(a.pulledAt);
          } else if (sort === 'name') {
            result = a.name.localeCompare(b.name);
          } else if (sort === 'set') {
            result = (a.set?.name || '').localeCompare(b.set?.name || '');
          } else if (sort === 'type') {
            result = getCardType(a).localeCompare(getCardType(b));
          } else if (sort === 'rarity') {
            result = (rarityOrder[a.rarity] || 999) - (rarityOrder[b.rarity] || 999);
          }
          if (result !== 0) return result;
        }
        return 0;
      });
    }

    return grouped;
  }, [filteredCollection, sortBy]);

  // Get unique rarities and sets from collection
  const uniqueRarities = useMemo(() => {
    const merged = new Set([...ALL_KNOWN_RARITIES, ...collection.map(card => card.rarity).filter(Boolean)]);
    const order = new Map(ALL_KNOWN_RARITIES.map((rarity, index) => [rarity, index]));
    return Array.from(merged).sort((a, b) => {
      const orderA = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
      const orderB = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
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


  const cardTradeRequests = useMemo(() => (tradeRequests || []).filter((trade) => trade?.offeredCards || trade?.requestedCards), [tradeRequests]);
  const pokemonTradeRequests = useMemo(() => (tradeRequests || []).filter((trade) => trade?.type === 'pokemon-trade' || trade?.offeredPokemon || trade?.requestedPokemon), [tradeRequests]);

  const tradeOfferCards = useMemo(() => {
    return [...collection].sort((a, b) => new Date(b.pulledAt || 0) - new Date(a.pulledAt || 0));
  }, [collection]);


  const previewOwnedIds = useMemo(() => new Set(collection.map(card => card.id)), [collection]);

  const sortedPreviewCards = useMemo(() => {
    const rarityOrder = {
      'Common': 1,
      'Uncommon': 2,
      'Rare': 3,
      'Rare Holo': 4,
      'Rare Holo EX': 5,
      'Rare Holo V': 6,
      'Rare Holo VMAX': 7,
      'Double Rare': 8,
      'Illustration Rare': 9,
      'Special Illustration Rare': 10,
      'Ultra Rare': 11,
      'Rare Ultra': 12,
      'Rare Rainbow': 13,
      'Hyper Rare': 14,
      'Secret Rare': 15,
      'Rare Secret': 16,
      'Amazing Rare': 17,
      'Rare BREAK': 18,
      'Rare Prism Star': 19,
      'ACE SPEC Rare': 20,
      'Rare Shiny': 21,
      'Shiny Rare': 22,
      'Radiant Rare': 23,
      'LEGEND': 24,
    };

    const term = previewSearchQuery.trim().toLowerCase();
    return [...previewCards]
      .filter(card => {
        if (hideOwnedInPreview && previewOwnedIds.has(card.id)) return false;
        if (!term) return true;
        return (card.name || '').toLowerCase().includes(term)
          || (card.number || '').toLowerCase().includes(term)
          || (card.rarity || '').toLowerCase().includes(term)
          || (card.types || []).some(type => type.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const rarityA = rarityOrder[a.rarity] || 999;
        const rarityB = rarityOrder[b.rarity] || 999;
        if (rarityA !== rarityB) return rarityA - rarityB;
        return (a.number || '').localeCompare(b.number || '', undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [previewCards, previewSearchQuery, hideOwnedInPreview, previewOwnedIds]);

  const uniqueTypes = useMemo(() => {
    const types = new Set();
    collection.forEach(card => {
      (card.types || []).forEach(type => {
        if (type) types.add(type);
      });
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [collection]);

  // Filtered packs based on search

  useEffect(() => {
    const tradeCount = Array.isArray(tradeRequests) ? tradeRequests.filter(Boolean).length : 0;
    const notificationCount = Array.isArray(socialNotifications) ? socialNotifications.filter((notification) => notification && !notification.read).length : 0;
    const battleCount = Array.isArray(battleRequests) ? battleRequests.filter(Boolean).length : 0;

    const totalSocialTradeSignals = tradeCount + notificationCount;
    if (totalSocialTradeSignals > 0 && tradeSoundCountRef.current === 0) {
      playTradeNotificationSound();
    } else if (totalSocialTradeSignals > tradeSoundCountRef.current) {
      playTradeNotificationSound();
    }

    if (battleCount > 0 && battleSoundCountRef.current === 0) {
      playBattleNotificationSound();
    } else if (battleCount > battleSoundCountRef.current) {
      playBattleNotificationSound();
    }

    tradeSoundCountRef.current = tradeCount + notificationCount;
    battleSoundCountRef.current = battleCount;
  }, [tradeRequests, socialNotifications, battleRequests]);

  const filteredPacks = useMemo(() => {
    if (!packSearchQuery) return sets;
    return sets.filter(set => 
      set.name.toLowerCase().includes(packSearchQuery.toLowerCase()) ||
      set.series.toLowerCase().includes(packSearchQuery.toLowerCase())
    );
  }, [sets, packSearchQuery]);

  const loadSets = async (options = {}) => {
    const { forceRefresh = false } = options;
    try {
      const cacheKey = setsCacheKey();
      if (!forceRefresh) {
        const cachedSets = readLocalCache(cacheKey, CACHE_TTL.sets);
        if (cachedSets?.length) {
          setSets(cachedSets);
          return cachedSets;
        }
      }

      const response = await fetch('/api/sets');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sets');
      }
      const nextSets = data.sets || [];
      setSets(nextSets);
      writeLocalCache(cacheKey, nextSets);
      return nextSets;
    } catch (err) {
      console.error('Error loading sets:', err);
      return [];
    }
  };


  useEffect(() => {
    const setIds = Array.from(new Set((sets || []).map((set) => set?.id).filter(Boolean)));
    if (!setIds.length) return;

    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const response = await fetch(`/api/set-counts?ids=${encodeURIComponent(setIds.join(','))}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load set counts');
        if (!cancelled) {
          setSetCardCounts(data.counts || {});
        }
      } catch (error) {
        console.error('Error loading set counts:', error);
      }
    };

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [sets]);

  const loadCollection = async (options = {}) => {
    if (!user) return [];
    const { forceRefresh = false } = options;
    try {
      const cacheKey = collectionCacheKey(user.id);
      if (!forceRefresh) {
        const cachedCollection = readLocalCache(cacheKey, CACHE_TTL.collection);
        if (Array.isArray(cachedCollection) && cachedCollection.length >= 0) {
          setCollection(cachedCollection);
          return cachedCollection;
        }
      }

      const pageSize = 200;
      let offset = 0;
      let allCards = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/collection?userId=${user.id}&offset=${offset}&limit=${pageSize}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load collection');
        }

        const cards = data.collection || [];
        allCards = [...allCards, ...cards];
        hasMore = !!data.hasMore;
        offset += cards.length;

        if (cards.length === 0) break;
      }

      setCollection(allCards);
      writeLocalCache(cacheKey, allCards);
      return allCards;
    } catch (err) {
      console.error('Error loading collection:', err);
      return [];
    }
  };

  const loadFriends = async (options = {}) => {
    if (!user) return null;
    const { forceRefresh = false } = options;
    try {
      const cacheKey = friendsCacheKey(user.id);
      if (!forceRefresh) {
        const cachedFriends = readLocalCache(cacheKey, CACHE_TTL.friends);
        if (cachedFriends) {
          setFriends(sortFriendsByOnline(cachedFriends.friends || []));
          setPendingRequests(cachedFriends.pendingRequests || []);
          setSentRequests(cachedFriends.sentRequests || []);
          setTradeRequests(cachedFriends.tradeRequests || []);
          setSocialNotifications(cachedFriends.socialNotifications || []);
          setBattleRequests(cachedFriends.battleRequests || []);
          return cachedFriends;
        }
      }

      const response = await fetch(`/api/friends?userId=${user.id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load friends');
      }
      setFriends(sortFriendsByOnline(data.friends || []));
      setPendingRequests(data.pendingRequests || []);
      setSentRequests(data.sentRequests || []);
      setTradeRequests(data.tradeRequests || []);
      setSocialNotifications(data.socialNotifications || []);
      setBattleRequests(data.battleRequests || []);
      if (data.activeBattleId) {
        window.location.href = `/battle?id=${data.activeBattleId}`;
        return data;
      }
      writeLocalCache(cacheKey, {
        friends: data.friends || [],
        pendingRequests: data.pendingRequests || [],
        sentRequests: data.sentRequests || [],
        tradeRequests: data.tradeRequests || [],
        socialNotifications: data.socialNotifications || [],
        battleRequests: data.battleRequests || [],
      });
      return data;
    } catch (err) {
      console.error('Error loading friends:', err);
      return null;
    }
  };



  const handleMarkNotificationsRead = async (notificationIds = []) => {
    if (!user?.id) return;
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, notificationIds })
      });
      setSocialNotifications((prev) => (prev || []).map((notification) => (
        notificationIds.length === 0 || notificationIds.includes(notification.id)
          ? { ...notification, read: true }
          : notification
      )));
      invalidateFriendsCache?.();
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const invalidateCollectionCache = (targetUserId = user?.id) => {
    if (targetUserId) clearLocalCache(collectionCacheKey(targetUserId));
  };

  const invalidateFriendsCache = (targetUserId = user?.id) => {
    if (targetUserId) clearLocalCache(friendsCacheKey(targetUserId));
  };

  const updateCollectionCache = (cards, targetUserId = user?.id) => {
    if (targetUserId) writeLocalCache(collectionCacheKey(targetUserId), cards);
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
        invalidateFriendsCache();
        loadFriends({ forceRefresh: true });
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
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
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
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
    } catch (err) {
      console.error('Error declining friend:', err);
    }
  };

  const handleOpenTradeModal = async (friend) => {
    setTradeFriend(friend);
    setSelectedTradeCards([]);
    setSelectedResponseCards([]);
    setTradeSearchWant('');
    setTradeSearchOffer('');
    setSearchQuery('');
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
        invalidateFriendsCache();
        invalidateCollectionCache();
        loadFriends({ forceRefresh: true });
        loadCollection({ forceRefresh: true });
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
        invalidateFriendsCache();
        invalidateCollectionCache();
        loadFriends({ forceRefresh: true });
        loadCollection({ forceRefresh: true });
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
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
    } catch (err) {
      console.error('Error declining trade:', err);
    }
  };

  const handleViewPokemonTrade = (trade) => {
    setActivePokemonTrade(trade);
  };

  const handleAcceptPokemonTrade = async (trade) => {
    try {
      const response = await fetch('/api/friends/accept-pokemon-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tradeId: trade.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error accepting Pokemon trade');
      alert(data.message || 'Pokemon trade completed');
      setActivePokemonTrade(null);
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
    } catch (err) {
      alert(err.message || 'Error accepting Pokemon trade');
    }
  };

  const handleDeclinePokemonTrade = async (trade) => {
    try {
      const response = await fetch('/api/friends/decline-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tradeId: trade.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error declining Pokemon trade');
      setActivePokemonTrade(null);
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
    } catch (err) {
      alert(err.message || 'Error declining Pokemon trade');
    }
  };

  const handleAcceptBattleRequest = async (request) => {
    try {
      const response = await fetch('/api/battles/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, requestId: request.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error accepting battle request');
      window.location.href = `/battle?id=${data.battle.id}`;
    } catch (err) {
      alert(err.message || 'Error accepting battle request');
    }
  };

  const handleDeclineBattleRequest = async (request) => {
    try {
      const response = await fetch('/api/battles/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, requestId: request.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error declining battle request');
      invalidateFriendsCache();
      loadFriends({ forceRefresh: true });
    } catch (err) {
      alert(err.message || 'Error declining battle request');
    }
  };

  const handleViewFriendProfile = async (friend) => {
    setViewingFriend(friend);
    setSearchQuery('');
    
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
    const isSelected = selectedForBreakdown.some((c) => c.id === card.id);
    if (isSelected) {
      setSelectedForBreakdown(selectedForBreakdown.filter((c) => c.id !== card.id));
    } else {
      setSelectedForBreakdown([...selectedForBreakdown, card]);
    }
  };

  const getBreakdownValue = (rarity) => getBreakdownValueForRarity(rarity);
  const isPremiumBreakdownRarity = (rarity) => !['Common', 'Uncommon', 'Rare', 'Rare Holo'].includes(rarity);

  const calculateMultiplesBreakdownSummary = () => {
    return groupedAndSortedCollection.reduce((summary, card) => {
      if (card.count > 1 && (breakdownIncludePremium || !isPremiumBreakdownRarity(card.rarity))) {
        const duplicatesToBreakDown = card.count - 1;
        summary.cards += duplicatesToBreakDown;
        summary.points += getBreakdownValue(card.rarity) * duplicatesToBreakDown;
      }
      return summary;
    }, { cards: 0, points: 0 });
  };

  const handleBreakdownCards = async () => {
    if (!breakdownAllMultiples) {
      alert('Check "Break down all multiples" to continue.');
      return;
    }

    const summary = calculateMultiplesBreakdownSummary();
    if (summary.cards === 0) {
      alert('You do not have any duplicate cards to break down.');
      return;
    }

    if (!window.confirm(`Break down all duplicate cards (${summary.cards} cards) for ${summary.points} points? This will leave 1 copy of each card in your collection.`)) {
      return;
    }

    try {
      const response = await fetch('/api/cards/breakdown-multiples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Successfully broke down ${data.cardsBreakdown} duplicate cards for ${data.pointsAwarded} points!`);
        setBreakdownMode(false);
        invalidateCollectionCache();
        loadCollection({ forceRefresh: true });
        setUser(prev => ({ ...prev, points: prev.points + data.pointsAwarded }));
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error breaking down duplicate cards');
    }
  };

  const handleBreakdownSelectedCards = async () => {
    if (!selectedForBreakdown.length) {
      alert('Select one or more cards to break down.');
      return;
    }
    const premiumSelected = selectedForBreakdown.some((card) => isPremiumBreakdownRarity(card.rarity));
    if (premiumSelected && !breakdownIncludePremium) {
      alert('Enable the premium breakdown option to include cards above Rare / Rare Holo.');
      return;
    }
    const totalPoints = selectedForBreakdown.reduce((sum, card) => sum + getBreakdownValue(card.rarity), 0);
    if (!window.confirm(`Break down ${selectedForBreakdown.length} selected cards for ${totalPoints} points? This can include last copies.`)) return;
    try {
      let totalAwarded = 0;
      for (const card of selectedForBreakdown) {
        const response = await fetch('/api/cards/breakdown-single-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, cardId: card.id })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to break down ${card.name}`);
        totalAwarded += data.pointsAwarded || 0;
      }
      alert(`Successfully broke down ${selectedForBreakdown.length} selected cards for ${totalAwarded} points!`);
      setSelectedForBreakdown([]);
      setBreakdownMode(false);
      invalidateCollectionCache();
      loadCollection({ forceRefresh: true });
      setUser(prev => ({ ...prev, points: prev.points + totalAwarded }));
    } catch (err) {
      alert(err.message || 'Error breaking down selected cards');
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

      const pointValue = getBreakdownValue(breakdownQuantityCard.rarity);
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

  useEffect(() => {
    if (!user?.id) return;
    loadDailyObjectives(user.id);
    const interval = setInterval(() => {
      loadDailyObjectives(user.id);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

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
        loadDailyObjectives(data.user.id);
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
        loadDailyObjectives(data.user.id);
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
    if (user?.id) {
      clearLocalCache(collectionCacheKey(user.id));
      clearLocalCache(friendsCacheKey(user.id));
    }
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



  const normalizePackCards = (cards = []) => (Array.isArray(cards) ? cards.filter(Boolean) : []).map((card) => ({
    ...card,
    images: card?.images || {},
  }));

  const normalizeRevealData = (revealData) => {
    if (!revealData || typeof revealData !== 'object') return null;

    const isBulk = !!revealData.isBulk;
    if (isBulk) {
      const packs = (Array.isArray(revealData.packs) ? revealData.packs : [])
        .filter(Boolean)
        .map((pack, index) => ({
          packNumber: pack?.packNumber || index + 1,
          cards: normalizePackCards(pack?.cards),
        }))
        .filter((pack) => pack.cards.length > 0);
      return { ...revealData, isBulk: true, packs };
    }

    return {
      ...revealData,
      isBulk: false,
      cards: normalizePackCards(revealData.cards),
    };
  };

  const hydrateRevealIntoUi = (revealData) => {
    const normalizedReveal = normalizeRevealData(revealData);
    if (!normalizedReveal) return false;

    const ownedCardIds = new Set((Array.isArray(collection) ? collection : []).filter(Boolean).map((c) => c.id));

    if (normalizedReveal.isBulk && (!normalizedReveal.packs || normalizedReveal.packs.length === 0)) return false;
    if (!normalizedReveal.isBulk && (!normalizedReveal.cards || normalizedReveal.cards.length === 0)) return false;

    if (normalizedReveal.isBulk && normalizedReveal.packs?.length) {
      const packsWithNewFlags = normalizedReveal.packs.map(pack => ({
        ...pack,
        cards: pack.cards.map(card => ({
          ...card,
          isNewCard: !ownedCardIds.has(card.id)
        }))
      }));
      setPulledCards(packsWithNewFlags);
    } else {
      const cardsWithNewFlag = (normalizedReveal.cards || []).map(card => ({
        ...card,
        isNewCard: !ownedCardIds.has(card.id)
      }));
      setPulledCards([{ packNumber: 1, cards: cardsWithNewFlag }]);
    }

    setPendingRevealId(normalizedReveal.revealId || normalizedReveal.id || null);
    if (normalizedReveal.pointsRemaining !== undefined) {
      setUser(prev => prev ? ({ ...prev, points: normalizedReveal.pointsRemaining }) : prev);
    }
    return true;
  };

  const recoverPendingPackReveal = async (targetUserId = user?.id) => {
    if (!targetUserId) return false;

    try {
      const response = await fetch(`/api/packs/pending?userId=${targetUserId}`);
      const data = await response.json();

      if (response.ok && data.reveal) {
        const hydrated = hydrateRevealIntoUi(data.reveal);
        setShowPackAnimation(false);
        if (hydrated) {
          setTimeout(() => setShowPackResults(true), 30);
        }
        return !!hydrated;
      }
    } catch (error) {
      console.error('Failed to recover pending pack reveal:', error);
    }

    return false;
  };

  const handleOpenPack = async (set, bulk = false) => {
    if (!user?.id || !set?.id || openingPack) return;

    setError('');
    setShowPackResults(false);
    setPulledCards([]);
    setPendingRevealId(null);
    setSelectedSet(set);
    setOpeningPack(true);
    setShowPackAnimation(true);

    if (packOpenTimeoutRef.current) {
      clearTimeout(packOpenTimeoutRef.current);
      packOpenTimeoutRef.current = null;
    }

    try {
      const response = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, setId: set.id, bulk })
      });

      const data = await response.json();

      if (response.ok) {
        packOpenTimeoutRef.current = setTimeout(() => {
          const hydrated = hydrateRevealIntoUi(data);
          setShowPackAnimation(false);
          packOpenTimeoutRef.current = null;

          if (!hydrated) {
            setError('Pack opened, but the reveal data was invalid. Please try reopening the results.');
            recoverPendingPackReveal(user.id);
            return;
          }

          setTimeout(() => setShowPackResults(true), 30);
          
          if (data.achievements) {
            setEarnedAchievements(data.achievements);
            setShowAchievementDialog(true);
          }
          
          invalidateCollectionCache();
          loadCollection({ forceRefresh: true });
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

    setShowPackResults(false);
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
      const cacheKey = previewCardsCacheKey(set.id);
      const cachedCards = readLocalCache(cacheKey, CACHE_TTL.previewCards);
      if (cachedCards?.length) {
        setPreviewCards(cachedCards);
        return;
      }

      const response = await fetch(`/api/cards?setId=${set.id}`);
      const data = await response.json();
      if (response.ok) {
        const nonEnergyCards = (data.cards || []).filter(card => card.supertype !== 'Energy');
        setPreviewCards(nonEnergyCards);
        writeLocalCache(cacheKey, nonEnergyCards);
      }
    } catch (err) {
      console.error('Error loading preview:', err);
    }
  };

  const closePreview = () => {
    setPreviewSet(null);
    setPreviewCards([]);
    setPreviewSearchQuery('');
    setHideOwnedInPreview(false);
  };

  const handleCardClick = (card) => {
    if (breakdownMode) {
      toggleBreakdownCard(card);
      return;
    }

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
      updateCollectionCache(updatedCollection);
    }
  };


  const handleToggleFavorite = async (card, event) => {
    event.stopPropagation();
    if (!user) return;

    const nextFavorite = !card.favorite;
    const updatedCollection = collection.map(existingCard => (
      existingCard.id === card.id ? { ...existingCard, favorite: nextFavorite } : existingCard
    ));

    setCollection(updatedCollection);
    updateCollectionCache(updatedCollection);

    try {
      const response = await fetch('/api/collection/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, cardId: card.id, favorite: nextFavorite })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update favorite');
      }
    } catch (error) {
      const revertedCollection = collection.map(existingCard => (
        existingCard.id === card.id ? { ...existingCard, favorite: card.favorite } : existingCard
      ));
      setCollection(revertedCollection);
      updateCollectionCache(revertedCollection);
      console.error('Error updating favorite:', error);
    }
  };


  const handleBreakdownSingleCopy = async () => {
    if (!selectedCard || !user) return;

    const pointsToGain = getBreakdownValue(selectedCard.rarity);
    if (!window.confirm(`Break down 1 copy of ${selectedCard.name} for ${pointsToGain} points?${selectedCard.count <= 1 ? ' This will remove your last copy.' : ''}`)) {
      return;
    }

    try {
      const response = await fetch('/api/cards/breakdown-single-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, cardId: selectedCard.id })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to break down card');
      }

      const updatedCollection = collection.filter((card, index) => {
        if (card.id !== selectedCard.id) return true;
        const firstMatchIndex = collection.findIndex(c => c.id === selectedCard.id);
        return index !== firstMatchIndex;
      });
      setCollection(updatedCollection);
      updateCollectionCache(updatedCollection);
      setUser(prev => ({ ...prev, points: prev.points + data.pointsAwarded }));
      setSelectedCard(null);
      invalidateCollectionCache();
      loadCollection({ forceRefresh: true });
    } catch (error) {
      alert(error.message || 'Error breaking down card');
    }
  };

  const getRarityColor = (rarity) => {
    if (!rarity) return 'bg-gray-500';
    if (rarity === 'Common') return 'bg-gray-500';
    if (rarity === 'Uncommon') return 'bg-green-500';
    if (rarity.includes('Hyper') || rarity.includes('Secret')) return 'bg-red-500';
    if (rarity.includes('Rainbow')) return 'bg-pink-500';
    if (rarity.includes('Ultra')) return 'bg-yellow-500';
    if (rarity.includes('Illustration')) return 'bg-orange-500';
    if (rarity.includes('Shiny')) return 'bg-emerald-500';
    if (rarity.includes('Double') || rarity.includes('EX')) return 'bg-blue-500';
    if (rarity.includes('Rare') || rarity.includes('Holo')) return 'bg-purple-500';
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
            <Button onClick={() => setShowDailyObjectives(true)} className="bg-amber-600 hover:bg-amber-500 border-2 border-amber-400 font-bold shadow-[0_0_15px_rgba(245,158,11,0.35)]">
              Daily Objectives
            </Button>
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

      {wildSpawnAnnouncement && (
        <div className="container mx-auto px-4 pt-6 relative z-10">
          <div className="mx-auto max-w-3xl rounded-xl border-2 border-red-500/40 bg-red-500/10 px-4 py-3 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold">🚨 A wild {wildSpawnAnnouncement.name} #{wildSpawnAnnouncement.id} has spawned in Pokémon Wilds!</div>
              <div className="flex items-center gap-2">
                <Link href="/wilds">
                  <Button size="sm" className="bg-red-500 text-white hover:bg-red-400">Go to Wilds</Button>
                </Link>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setWildSpawnAnnouncement(null)}>Dismiss</Button>
              </div>
            </div>
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
            <TabsTrigger value="friends" className="relative flex items-center gap-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(6,182,212,0.6)] font-bold text-cyan-100 transition-all">
              <Users className="h-4 w-4" />
              Friends
              {unreadSocialCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unreadSocialCount}
                </span>
              )}
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
                            {set.series} • {setCardCounts[set.id] ?? set.total} cards
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
                  setBreakdownAllMultiples(true);
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
                      Duplicate cards: {calculateMultiplesBreakdownSummary().cards} = {calculateMultiplesBreakdownSummary().points} points
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={breakdownAllMultiples}
                        onChange={(e) => setBreakdownAllMultiples(e.target.checked)}
                        className="h-4 w-4 accent-red-500"
                      />
                      Break down all multiples (leave 1 copy)
                    </label>
                    <div className="mt-3 rounded-lg border border-yellow-400/40 bg-yellow-900/20 p-3 shadow-[0_0_20px_rgba(250,204,21,0.12)]">
                      <p className="text-sm font-bold text-yellow-300">Premium Breakdown</p>
                      <label className="mt-2 flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={breakdownIncludePremium}
                          onChange={(e) => setBreakdownIncludePremium(e.target.checked)}
                          className="h-4 w-4 accent-yellow-500"
                        />
                        Include cards above Rare / Rare Holo
                      </label>
                      <p className="mt-1 text-xs text-yellow-100/80">Required for any rarity above Common, Uncommon, Rare, or Rare Holo.</p>
                    </div>
                    <p className="mt-2 text-sm text-cyan-100/80">Selected cards: {selectedForBreakdown.length} = {selectedForBreakdown.reduce((sum, card) => sum + getBreakdownValue(card.rarity), 0)} points</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleBreakdownCards}
                      disabled={!breakdownAllMultiples || calculateMultiplesBreakdownSummary().cards === 0}
                      className="bg-red-500 hover:bg-red-400 text-white font-bold"
                    >
                      Break Down Duplicates
                    </Button>
                    <Button
                      onClick={handleBreakdownSelectedCards}
                      disabled={selectedForBreakdown.length === 0}
                      className="bg-orange-500 hover:bg-orange-400 text-white font-bold"
                    >
                      Break Down Selected
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="relative z-50 overflow-visible bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg p-4 mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-visible">
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
                <details className="relative z-40">
                  <summary className="list-none cursor-pointer rounded-md border-2 border-cyan-500/30 bg-slate-700/50 px-3 py-2 text-white font-medium">
                    {sortBy.length === 0 ? 'No Sort' : sortBy.length === 1 ? (SORT_OPTIONS.find(option => option.value === sortBy[0])?.label || 'Sort By') : `${sortBy.length} Sorts Selected`}
                  </summary>
                  <div className="absolute z-[200] mt-2 w-72 rounded-md border border-cyan-500/30 bg-slate-800 p-3 shadow-lg">
                    <div className="mb-2 flex justify-between text-xs">
                      <button type="button" className="text-cyan-400" onClick={() => setSortBy(['newest'])}>Default</button>
                    </div>
                    <div className="space-y-2 text-sm text-white">
                      {SORT_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sortBy.includes(option.value)}
                            onChange={() => toggleSortOption(option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>

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
                    {uniqueTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters Display */}
              {(searchQuery || rarityFilter !== 'all' || setFilter !== 'all' || typeFilter !== 'all' || sortBy.length > 0) && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-cyan-400">Active:</span>
                  {searchQuery && (
                    <Badge className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Search: {searchQuery}
                    </Badge>
                  )}
                  {sortBy.map((sort) => (
                    <Badge key={`sort-${sort}`} className="bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                      Sort: {SORT_OPTIONS.find(option => option.value === sort)?.label || sort}
                    </Badge>
                  ))}
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
                      setSortBy(['newest']);
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
                        setSortBy(['newest']);
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
                    const isSelectedForBreakdown = selectedForBreakdown.some((selected) => selected.id === card.id);
                    return (
                      <Card 
                        key={card.id} 
                        className={`group overflow-visible hover:scale-110 hover:z-50 transition-transform bg-slate-800/50 backdrop-blur-sm border-2 ${
                          isSelectedForBreakdown 
                            ? 'border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]' 
                            : 'border-cyan-500/30 hover:border-cyan-500 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                        } cursor-pointer relative`}
                        onClick={() => handleCardClick(card)}
                      >
                        <div className="relative">
                          <img
                            src={card.images?.small || '/placeholder.png'}
                            alt={card.name}
                            className="w-full h-auto rounded-t"
                          />
                          {!breakdownMode && (
                            <button
                              type="button"
                              aria-label={card.favorite ? 'Remove favorite' : 'Add favorite'}
                              className={`absolute top-2 right-2 z-20 rounded-full border border-yellow-300/70 bg-slate-900/80 p-1.5 transition-all ${card.favorite ? 'opacity-100 shadow-[0_0_15px_rgba(250,204,21,0.7)]' : 'opacity-0 group-hover:opacity-100 hover:opacity-100'}`}
                              onClick={(event) => handleToggleFavorite(card, event)}
                            >
                              <Star className={`h-4 w-4 ${card.favorite ? 'fill-yellow-300 text-yellow-300' : 'text-yellow-200'}`} />
                            </button>
                          )}
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
                            <Badge className="absolute top-12 right-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white border border-cyan-300 text-xs shadow-[0_0_10px_rgba(6,182,212,0.5)]">
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-cyan-400">Friends ({friends.length})</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => loadPlayerCard(user.id)}
                    className="bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.25)]"
                  >
                    My Player Card
                  </Button>
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
                                <p className="text-white font-medium flex items-center gap-2">{friend.username}{friend.isOnline && <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />}</p>
                                <p className="text-xs text-cyan-400">{friend.battleWins || 0} wins • {friend.tradesCompleted || 0} trades</p>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-wrap justify-end">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadPlayerCard(friend.id);
                                }}
                                className="bg-fuchsia-600 text-white hover:bg-fuchsia-500 text-xs"
                              >
                                Player Card
                              </Button>
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
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFriend(friend);
                                }}
                                className="bg-red-600 text-white hover:bg-red-500 text-xs"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>


              <Card className="border-2 border-cyan-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-cyan-400">Trade & Social Notifications ({(socialNotifications || []).filter((notification) => !notification?.read).length})</CardTitle>
                  {(socialNotifications || []).some((notification) => !notification?.read) && (
                    <Button size="sm" onClick={() => handleMarkNotificationsRead([])} className="bg-cyan-700 hover:bg-cyan-600">Mark all read</Button>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {(socialNotifications || []).length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No new notifications</p>
                    ) : (
                      <div className="space-y-2">
                        {(socialNotifications || []).map((notification) => (
                          <div key={notification.id} className={`rounded p-3 ${notification.read ? 'bg-slate-700/30' : 'bg-cyan-900/30 border border-cyan-500/30'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-white text-sm font-medium">{notification.message}</p>
                                <p className="text-xs text-cyan-100/50 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                              </div>
                              {!notification.read && (
                                <Button size="sm" onClick={() => handleMarkNotificationsRead([notification.id])} className="bg-cyan-700 hover:bg-cyan-600 text-xs">Read</Button>
                              )}
                            </div>
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
                  <CardTitle className="text-purple-400">Card Trade Requests ({cardTradeRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {cardTradeRequests.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No trade requests</p>
                    ) : (
                      <div className="space-y-2">
                        {cardTradeRequests.map((trade) => (
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

              <Card className="border-2 border-fuchsia-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(217,70,239,0.2)]">
                <CardHeader>
                  <CardTitle className="text-fuchsia-400">Pokemon Wilds Trade Requests ({pokemonTradeRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {pokemonTradeRequests.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No Pokemon Wilds trade requests</p>
                    ) : (
                      <div className="space-y-2">
                        {pokemonTradeRequests.map((trade) => (
                          <div key={trade.id} className="p-2 bg-slate-700/50 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-semibold">{trade.fromUsername}</span>
                              <Badge className="bg-fuchsia-500">{trade.offeredPokemon?.length || 0} Pokemon</Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleViewPokemonTrade(trade)} className="w-full bg-fuchsia-500 text-white hover:bg-fuchsia-400">View Trade Request</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-500/30 bg-slate-800/50 backdrop-blur-sm shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <CardHeader>
                  <CardTitle className="text-red-400">Battle Requests ({battleRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    {battleRequests.length === 0 ? (
                      <p className="text-cyan-100/50 text-center py-4">No battle requests</p>
                    ) : (
                      <div className="space-y-2">
                        {battleRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                            <div>
                              <span className="text-white font-semibold">{request.from.username}</span>
                              <p className="text-xs text-cyan-100/60">wants to battle</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleAcceptBattleRequest(request)} className="bg-green-500 text-white hover:bg-green-400">Accept</Button>
                              <Button size="sm" onClick={() => handleDeclineBattleRequest(request)} className="bg-red-500 text-white hover:bg-red-400">Decline</Button>
                            </div>
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
        <div className="mt-10 pb-6 text-center text-xs text-cyan-100/55">
          Pokémon and all related names, characters, images, and trademarks are owned by The Pokémon Company. This is an unofficial fan site made by fans.
        </div>
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
            <p className="mt-4 text-lg font-bold text-cyan-100">Ripping open your {selectedSet?.name || 'selected'} pack...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pack Results Dialog */}
      <Dialog open={showPackResults} onOpenChange={(open) => { if (!open) closePackResults(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white bg-gradient-to-r from-cyan-500/20 to-transparent py-3 -mx-6 -mt-6 mb-4 border-b-4 border-cyan-500/50 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              {pulledCards.length > 1 ? `Opened ${pulledCards.length} Packs!` : 'You pulled these cards!'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[62vh] pb-2">
            <div className="space-y-6 p-4">
              {(Array.isArray(pulledCards) ? pulledCards : []).filter(Boolean).map((pack, packIndex) => (
                <div key={packIndex} className="space-y-3">
                  {pulledCards.length > 1 && (
                    <h3 className="text-lg font-bold text-cyan-400 border-b border-cyan-500/30 pb-2">
                      Pack #{pack.packNumber}
                    </h3>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {(Array.isArray(pack?.cards) ? pack.cards : []).filter(Boolean).map((card, cardIndex) => (
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
                              {card.rarity || 'Common'}
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
              <h3 className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                {selectedCard?.name}
              </h3>
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

            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleBreakdownSingleCopy}
                className="bg-red-600 text-white hover:bg-red-500 border-2 border-red-400 font-bold"
              >
                Break Down 1 Copy
              </Button>
              <Button
                onClick={() => setSelectedCard(null)}
                className="bg-cyan-500 text-black hover:bg-cyan-400 border-2 border-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] transition-all"
              >
                Close
              </Button>
            </div>
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(6,182,212,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">
              {previewSet?.name} - All Cards
            </DialogTitle>
            <p className="text-center text-cyan-100/70 font-medium mt-2">
              {previewCards.length} cards available in this set
            </p>
            <p className="text-center text-cyan-300/80 text-sm mt-1">
              Sorted by rarity
            </p>
            <div className="pt-4 px-2 space-y-3">
              <Input
                value={previewSearchQuery}
                onChange={(e) => setPreviewSearchQuery(e.target.value)}
                placeholder="Search cards in this set..."
                className="bg-slate-800/80 border-cyan-500/40 text-white placeholder:text-cyan-200/50"
              />
              <label className="flex items-center justify-center gap-2 text-sm text-cyan-100/80 select-none">
                <input
                  type="checkbox"
                  checked={hideOwnedInPreview}
                  onChange={(e) => setHideOwnedInPreview(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                Hide/Show Owned
              </label>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[62vh] pb-2">
            {previewCards.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Package className="h-20 w-20 text-cyan-400 animate-spin" />
              </div>
            ) : sortedPreviewCards.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-cyan-100/70 font-medium">
                No cards match your search.
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
                {sortedPreviewCards.map((card) => {
                  const isOwned = previewOwnedIds.has(card.id);
                  return (
                  <Card 
                    key={card.id} 
                    className={`overflow-hidden hover:scale-105 transition-transform backdrop-blur-sm border-2 cursor-pointer ${isOwned ? 'bg-slate-700/40 border-slate-500/50 opacity-65 grayscale-[0.35]' : 'bg-slate-800/50 border-cyan-500/30 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]'}`}
                    onClick={() => setSelectedCard(card)}
                  >
                    <div className="relative">
                      <img
                        src={card.images?.small || '/placeholder.png'}
                        alt={card.name}
                        className="w-full h-auto"
                      />
                      {isOwned && (
                        <Badge className="absolute top-1 right-1 bg-emerald-600/90 text-white border border-emerald-300/70 text-[10px] shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                          Owned
                        </Badge>
                      )}
                      <Badge className={`absolute bottom-1 left-1 border border-cyan-500/50 text-[10px] shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getRarityColor(card.rarity)}`}>
                        {card.rarity || 'Common'}
                      </Badge>
                    </div>
                  </Card>
                )})}
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


      <Dialog open={!!activePokemonTrade} onOpenChange={() => setActivePokemonTrade(null)}>
        <DialogContent className="max-w-2xl border-4 border-fuchsia-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-fuchsia-400">Pokemon Wilds Trade Request</DialogTitle>
          </DialogHeader>
          {activePokemonTrade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-fuchsia-500/30 bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-fuchsia-300 text-lg">They offer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activePokemonTrade.offeredPokemon?.[0]?.pokemonData ? (
                      <div className="flex items-center gap-3">
                        <img src={activePokemonTrade.offeredPokemon[0].pokemonData.sprite} alt={activePokemonTrade.offeredPokemon[0].pokemonData.displayName} className="w-20 h-20" />
                        <div>
                          <p className="text-white font-bold">{activePokemonTrade.offeredPokemon[0].pokemonData.displayName}</p>
                          <p className="text-cyan-100/70 text-sm">Level {activePokemonTrade.offeredPokemon[0].pokemonData.level}</p>
                        </div>
                      </div>
                    ) : <p className="text-cyan-100/60">No offered Pokemon data</p>}
                  </CardContent>
                </Card>
                <Card className="border-2 border-cyan-500/30 bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-cyan-300 text-lg">For your</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activePokemonTrade.requestedPokemon?.[0]?.pokemonData ? (
                      <div className="flex items-center gap-3">
                        <img src={activePokemonTrade.requestedPokemon[0].pokemonData.sprite} alt={activePokemonTrade.requestedPokemon[0].pokemonData.displayName} className="w-20 h-20" />
                        <div>
                          <p className="text-white font-bold">{activePokemonTrade.requestedPokemon[0].pokemonData.displayName}</p>
                          <p className="text-cyan-100/70 text-sm">Level {activePokemonTrade.requestedPokemon[0].pokemonData.level}</p>
                        </div>
                      </div>
                    ) : <p className="text-cyan-100/60">No requested Pokemon data</p>}
                  </CardContent>
                </Card>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleAcceptPokemonTrade(activePokemonTrade)} className="flex-1 bg-green-500 text-white hover:bg-green-400">Accept Trade</Button>
                <Button onClick={() => handleDeclinePokemonTrade(activePokemonTrade)} className="flex-1 bg-red-500 text-white hover:bg-red-400">Decline Trade</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trade Modal - Send Trade */}

      <Dialog open={showPlayerCard} onOpenChange={setShowPlayerCard}>
        <DialogContent className="max-w-xl border-4 border-cyan-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
              <Users className="h-6 w-6" />
              {playerCard?.username}'s Player Card
            </DialogTitle>
          </DialogHeader>

          {playerCard && (
            <div className="space-y-4">
              <Card className="border-2 border-cyan-500/30 bg-slate-800/60">
                <CardContent className="pt-6 text-center space-y-2">
                  <p className={`text-sm font-bold ${playerCard.trainerRank?.textClass || 'text-white'}`} style={playerCard.trainerRank?.color ? { color: playerCard.trainerRank.color } : undefined}>{playerCard.trainerRank?.label || 'Trainer'}</p>
                  <p className={`text-3xl font-bold ${playerCard.trainerRank?.textClass || 'text-white'}`} style={playerCard.trainerRank?.color ? { color: playerCard.trainerRank.color } : undefined}>{playerCard.username}</p>
                  {playerCard.baseTrainerRank && (
                    <p className="text-xs text-slate-400">Battle Rank: <span className={playerCard.baseTrainerRank.textClass || 'text-white'} style={playerCard.baseTrainerRank?.color ? { color: playerCard.baseTrainerRank.color } : undefined}>{playerCard.baseTrainerRank.label}</span></p>
                  )}
                  {playerCard.id === user?.id && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold text-cyan-300 mb-2">Displayed Title</p>
                      <select
                        value={playerCard.selectedTitleId || ''}
                        onChange={(e) => handleSelectPlayerTitle(e.target.value)}
                        className="w-full rounded-md border border-cyan-500/30 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      >
                        {(playerCard.availableTitles || []).map((title) => (
                          <option key={title.id} value={title.id}>
                            {title.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-red-500/30 bg-slate-800/50">
                  <CardContent className="pt-6 text-center">
                    <p className="text-4xl font-bold text-red-300">{playerCard.battleWins || 0}</p>
                    <p className="text-sm text-red-100/70">Battles Won</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-purple-500/30 bg-slate-800/50">
                  <CardContent className="pt-6 text-center">
                    <p className="text-4xl font-bold text-purple-300">{playerCard.tradesCompleted || 0}</p>
                    <p className="text-sm text-purple-100/70">Trades Completed</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2 border-cyan-500/30 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Favorite Card</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {playerCard.id === user?.id && (
                    <div>
                      <p className="text-xs font-semibold text-cyan-300 mb-2">Choose Favorite Card</p>
                      <select
                        value={playerCard.favoriteCardId || ''}
                        onChange={(e) => handleSelectFavoriteCard(e.target.value)}
                        className="w-full rounded-md border border-cyan-500/30 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      >
                        <option value="">Select a favorite card</option>
                        {(playerCard.favoriteCardOptions || []).map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.name}{card.setName ? ` — ${card.setName}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {playerCard.favoriteCard ? (
                    <div className="flex items-center gap-4">
                      {playerCard.favoriteCard.images?.small && (
                        <img src={playerCard.favoriteCard.images.small} alt={playerCard.favoriteCard.name} className="h-28 w-20 rounded-md object-cover border border-cyan-400/30" />
                      )}
                      <div>
                        <p className="text-xl font-bold text-white">{playerCard.favoriteCard.name}</p>
                        <p className="text-sm text-slate-300">{playerCard.favoriteCard.rarity || 'Unknown Rarity'}</p>
                        <p className="text-sm text-slate-400">{playerCard.favoriteCard.set?.name || ''}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400">No favorite card selected yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-yellow-500/30 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-yellow-400">Favorite Pokémon</CardTitle>
                </CardHeader>
                <CardContent>
                  {playerCard.favoritePokemon ? (
                    <div className="flex items-center gap-4">
                      <img src={playerCard.favoritePokemon.sprite} alt={playerCard.favoritePokemon.displayName} className="h-24 w-24 object-contain" />
                      <div>
                        <p className="text-xl font-bold text-white flex items-center gap-2">
                          {playerCard.favoritePokemon.nickname || playerCard.favoritePokemon.displayName}
                          {playerCard.favoritePokemon.isShiny && <span className="text-yellow-400">✨</span>}
                        </p>
                        <p className="text-sm text-slate-300">Level {playerCard.favoritePokemon.level || 1}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(playerCard.favoritePokemon.types || []).map((type) => (
                            <Badge key={type} className="bg-slate-700 text-white capitalize">{type}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400">No favorite Pokémon selected yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Daily Objectives Modal */}
      <Dialog open={showDailyObjectives} onOpenChange={setShowDailyObjectives}>
        <DialogContent className="max-w-xl border-4 border-amber-500/50 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_60px_rgba(245,158,11,0.25)]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-400">Daily Objectives</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {dailyObjectives?.objectives?.length ? dailyObjectives.objectives.map((objective) => (
              <Card key={objective.id} className={`border-2 ${objective.completed ? 'border-green-500/40 bg-green-950/30' : 'border-amber-500/30 bg-slate-800/50'}`}>
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-bold">{objective.label}</p>
                    <p className="text-sm text-slate-300">Progress: {objective.progress}/{objective.target}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-300 font-bold">+{objective.rewardPoints} pts</p>
                    <p className={`text-xs font-semibold ${objective.completed ? 'text-green-300' : 'text-slate-400'}`}>
                      {objective.completed ? 'Completed' : 'In progress'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-slate-400">Loading daily objectives...</p>
            )}
            <p className="pt-2 text-center text-sm text-amber-200/80">Objectives will reset daily.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTradeModal} onOpenChange={setShowTradeModal}>
        <DialogContent className="max-w-7xl max-h-[90vh] border-4 border-purple-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Trade with {tradeFriend?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-cyan-400">
                What you want ({selectedResponseCards.length}/10)
              </h3>
              <p className="text-xs text-cyan-100/70">Browse {tradeFriend?.username}'s collection (optional - leave empty for free gift)</p>
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

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-purple-400">
                What you're offering ({selectedTradeCards.length}/10)
              </h3>
              <p className="text-xs text-purple-100/70">Select from your collection (required)</p>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-purple-400" />
                <Input
                  placeholder="Search your cards..."
                  value={tradeSearchOffer}
                  onChange={(e) => setTradeSearchOffer(e.target.value)}
                  className="pl-8 border-2 border-purple-500/30 bg-slate-700/50 text-white text-sm"
                />
              </div>

              <ScrollArea className="h-96 border-2 border-purple-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {tradeOfferCards
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

            <div className="flex justify-between items-center pt-4 border-t border-cyan-500/30">
              <Button onClick={() => setViewingFriend(null)} variant="outline">
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
      <Dialog open={!!activeTrade} onOpenChange={() => setActiveTrade(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-4 border-purple-500/50 bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Trade Request from {activeTrade?.fromUsername}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-green-400">
                They're giving you: ({activeTrade?.offeredCards?.length || 0} cards)
              </h3>
              <ScrollArea className="h-96 border-2 border-green-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activeTrade?.offeredCards?.map((card, index) => (
                    <Card key={index} className="border-2 border-green-500/30">
                      <img src={card.images?.small} alt={card.name} className="w-full" />
                      <p className="text-xs text-center text-white p-1 bg-slate-900/50">{card.name}</p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-red-400">
                They want from you: ({activeTrade?.requestedCards?.length || 0} cards)
              </h3>
              <ScrollArea className="h-96 border-2 border-red-500/30 rounded p-2 bg-slate-800/30">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activeTrade?.requestedCards?.map((card, index) => (
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
      <Dialog open={false && showBreakdownQuantityModal} onOpenChange={() => {
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
                          return getBreakdownValue(breakdownQuantityCard.rarity);
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
                          return getBreakdownValue(breakdownQuantityCard.rarity) * breakdownQuantity;
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