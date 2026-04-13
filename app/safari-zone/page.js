'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Sparkles, Candy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SAFARI_ZONE_COST } from '@/lib/safari-zone';

function getTypeColor(type) {
  const colors = {
    normal: 'bg-gray-400', fire: 'bg-red-500', water: 'bg-blue-500',
    electric: 'bg-yellow-400', grass: 'bg-green-500', ice: 'bg-cyan-300',
    fighting: 'bg-red-700', poison: 'bg-purple-500', ground: 'bg-yellow-600',
    flying: 'bg-indigo-400', psychic: 'bg-pink-500', bug: 'bg-lime-500',
    rock: 'bg-yellow-700', ghost: 'bg-purple-700', dragon: 'bg-indigo-600',
    dark: 'bg-gray-700', steel: 'bg-gray-400', fairy: 'bg-pink-300'
  };
  return colors[type] || 'bg-gray-500';
}

export default function SafariZonePage() {
  const [user, setUser] = useState(null);
  const [zone, setZone] = useState(null);
  const [spawn, setSpawn] = useState(null);
  const [nextSpawnAt, setNextSpawnAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [showThrowAnimation, setShowThrowAnimation] = useState(false);
  const safariLoadInFlightRef = useRef(false);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      window.location.href = '/';
      return;
    }
    fetch(`/api/session?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          window.location.href = '/';
          return;
        }
        setUser(data.user);
      })
      .catch(() => {
        window.location.href = '/';
      });
  }, []);

  const loadSafariZone = async (resolvedUserId = user?.id) => {
    if (!resolvedUserId || safariLoadInFlightRef.current) return;

    safariLoadInFlightRef.current = true;
    try {
      const response = await fetch(`/api/safari-zone/current?userId=${resolvedUserId}&ts=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          setZone(null);
          setSpawn(null);
          setNextSpawnAt(null);
          if (data?.expired) {
            setMessage('Your Safari Zone run expired. Returning to Wilds...');
            setTimeout(() => { window.location.href = '/wilds'; }, 900);
          }
        }
        return;
      }

      setZone(data.safariZone || null);
      setSpawn(data.spawn || null);
      setNextSpawnAt(data.nextSpawnAt || null);
    } catch {
      // Keep the active run visible during transient polling failures.
    } finally {
      safariLoadInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadSafariZone(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      setNow(Date.now());
      loadSafariZone(user.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const countdown = useMemo(() => {
    if (!nextSpawnAt) return null;
    const totalSeconds = Math.max(0, Math.floor((nextSpawnAt - now) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [nextSpawnAt, now]);

  const runTimeRemaining = useMemo(() => {
    if (!zone?.expiresAt) return null;
    const totalSeconds = Math.max(0, Math.floor((zone.expiresAt - now) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [zone?.expiresAt, now]);

  const enterSafariZone = async () => {
    if (!user?.id || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/safari-zone/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to enter Safari Zone');
      setUser((prev) => ({ ...prev, points: data.pointsRemaining }));
      setZone(data.safariZone || null);
      setSpawn(data.safariZone?.currentSpawn || data.safariZone?.spawn || null);
      await loadSafariZone(user.id);
      setMessage(`Entered the Safari Zone: ${data.safariZone?.biomeName || 'Unknown Biome'}`);
    } catch (error) {
      setMessage(error.message || 'Failed to enter Safari Zone');
    } finally {
      setShowThrowAnimation(false);
      setActionLoading(false);
    }
  };

  const useSnack = async () => {
    if (!user?.id || !spawn || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/safari-zone/snack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to use Poké Snack');
      setZone((prev) => prev ? { ...prev, snacksRemaining: data.snacksRemaining } : prev);
      setSpawn(data.spawn || null);
      setMessage('Poké Snack used! Catch rate increased for this encounter.');
    } catch (error) {
      setMessage(error.message || 'Failed to use Poké Snack');
    } finally {
      setActionLoading(false);
    }
  };

  const catchPokemon = async () => {
    if (!user?.id || !spawn || actionLoading) return;
    setActionLoading(true);
    setShowThrowAnimation(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      const response = await fetch('/api/safari-zone/catch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Safari Zone catch failed');
      if (data.caught) {
        setSpawn(null);
        setNextSpawnAt(data.nextSpawnAt || null);
      } else if (data.spawn) {
        setSpawn(data.spawn);
        setNextSpawnAt(null);
      } else {
        setSpawn(null);
        setNextSpawnAt(data.nextSpawnAt || null);
      }
      setMessage(data.message || (data.caught ? 'Caught!' : 'It got away!'));
    } catch (error) {
      setMessage(error.message || 'Safari Zone catch failed');
    } finally {
      setActionLoading(false);
    }
  };

  const runFromPokemon = async () => {
    if (!user?.id || !spawn || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/safari-zone/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run from Pokémon');
      setSpawn(null);
      setNextSpawnAt(data.nextSpawnAt || null);
      setMessage(data.message || 'You ran away.');
    } catch (error) {
      setMessage(error.message || 'Failed to run from Pokémon');
    } finally {
      setActionLoading(false);
    }
  };

  const backgroundStyle = zone?.backgroundPath
    ? {
        backgroundImage: `linear-gradient(rgba(3, 12, 10, 0.55), rgba(3, 12, 10, 0.78)), url(${zone.backgroundPath})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className="min-h-screen text-white" style={backgroundStyle || { background: 'linear-gradient(135deg, rgb(2,44,34), rgb(20,83,45), rgb(54,83,20))' }}>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6 backdrop-blur-[1px]">
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-4xl font-bold text-emerald-300">Safari Zone</h1>
          {zone?.biomeName && <p className="text-2xl font-semibold text-emerald-100">{zone.biomeName}</p>}
          {runTimeRemaining && <p className="text-lg font-bold text-yellow-200">Time Remaining: {runTimeRemaining}</p>}
          <Link href="/wilds">
            <Button className="bg-slate-800 hover:bg-slate-700 border border-emerald-400/40">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Wilds
            </Button>
          </Link>
        </div>

        {message && (
          <Card className="border border-emerald-400/40 bg-emerald-950/40">
            <CardContent className="py-3 text-sm text-emerald-100">{message}</CardContent>
          </Card>
        )}

        {!zone ? (
          <Card className="border-2 border-emerald-400/40 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-2xl text-emerald-300">Start a Safari Zone run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-emerald-50">
              <p>Spend {SAFARI_ZONE_COST.toLocaleString()} points to enter a biome for 5 minutes. You'll receive 3 Poké Snacks and encounter a themed stream of Pokémon with boosted shiny odds.</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-100">
                <li>1/800 shiny odds</li>
                <li>Legendary and mythical Pokémon can take up to 3 throws to catch</li>
                <li>Poké Snacks boost catch rate by 20%</li>
              </ul>
              <Button
                onClick={enterSafariZone}
                disabled={loading || actionLoading || !user || (user.points || 0) < SAFARI_ZONE_COST}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
              >
                {actionLoading ? 'Entering…' : `Enter Safari Zone (${SAFARI_ZONE_COST.toLocaleString()} pts)`}
              </Button>
              {user && (user.points || 0) < SAFARI_ZONE_COST && (
                <p className="text-sm text-amber-200">You need more points before you can enter.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card className="border-2 border-emerald-400/40 bg-slate-950/55">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl text-emerald-300">Current Encounter</CardTitle>
                {countdown && !spawn && (
                  <p className="text-sm text-emerald-100">Next Pokémon arrives in {countdown}</p>
                )}
              </CardHeader>
              <CardContent>
                {spawn ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full border-4 border-emerald-300/60 bg-black/20 p-6 shadow-2xl">
                        <img
                          src={spawn.sprite}
                          alt={spawn.displayName}
                          className="h-48 w-48 object-contain"
                        />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-white">
                          {spawn.displayName}
                          {spawn.isShiny && <span className="text-yellow-300"> ✨</span>}
                        </h2>
                        <p className="text-emerald-100">Level {spawn.level} • {spawn.safariRarity?.toUpperCase?.() || 'COMMON'}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {spawn.types?.map((type) => (
                          <Badge key={type} className={`${getTypeColor(type)} text-white uppercase tracking-wide`}>
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Card className="border border-emerald-400/30 bg-slate-900/60">
                        <CardContent className="py-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Catch Rate</p>
                          <p className="mt-2 text-2xl font-bold text-white">{spawn.catchRate}%</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-emerald-400/30 bg-slate-900/60">
                        <CardContent className="py-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Attempts Used</p>
                          <p className="mt-2 text-2xl font-bold text-white">{spawn.attemptsUsed || 0}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-emerald-400/30 bg-slate-900/60">
                        <CardContent className="py-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-emerald-200">Max Attempts</p>
                          <p className="mt-2 text-2xl font-bold text-white">{spawn.maxAttempts || 1}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={catchPokemon}
                        disabled={actionLoading}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                      >
                        {showThrowAnimation && actionLoading ? 'Throwing…' : 'Throw Safari Ball'}
                      </Button>
                      <Button
                        onClick={useSnack}
                        disabled={actionLoading || (zone?.snacksRemaining ?? 0) <= 0 || spawn.snackApplied}
                        className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold"
                      >
                        <Candy className="mr-2 h-4 w-4" />
                        {spawn.snackApplied ? 'Snack Active' : `Use Poké Snack (${zone?.snacksRemaining ?? 0})`}
                      </Button>
                      <Button
                        onClick={runFromPokemon}
                        disabled={actionLoading}
                        variant="outline"
                        className="border-emerald-300/40 bg-slate-900/40 text-emerald-50 hover:bg-slate-800"
                      >
                        Run Away
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
                    <div className="rounded-full border border-emerald-300/30 bg-slate-900/40 p-6">
                      <Clock className="h-14 w-14 text-emerald-300" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-emerald-200">Waiting for the next encounter…</h2>
                      <p className="text-emerald-100">
                        {countdown ? `A Pokémon should appear in ${countdown}.` : 'Refreshing the biome...'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border border-emerald-400/40 bg-slate-950/55">
                <CardHeader>
                  <CardTitle className="text-xl text-emerald-300">Safari Perks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-emerald-100">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 text-yellow-300" />
                    <p>Safari Zone encounters have elevated shiny odds compared to standard Wilds spawns.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Candy className="mt-0.5 h-4 w-4 text-amber-300" />
                    <p>Use Poké Snacks wisely to boost your catch chance on rare encounters.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <p>Your run lasts 5 minutes, so keep an eye on the timer.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-emerald-400/40 bg-slate-950/55">
                <CardHeader>
                  <CardTitle className="text-xl text-emerald-300">Biome Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-emerald-100">
                  <p><span className="font-semibold text-white">Biome:</span> {zone.biomeName}</p>
                  <p><span className="font-semibold text-white">Snacks Remaining:</span> {zone.snacksRemaining ?? 0}</p>
                  <p><span className="font-semibold text-white">Shiny Rate:</span> 1 / {Math.round(1 / (zone.shinyRate || (1 / 800)))}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
