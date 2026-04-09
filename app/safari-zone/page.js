'use client';

import { useEffect, useMemo, useState } from 'react';
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
    if (!resolvedUserId) return;
    try {
      const response = await fetch(`/api/safari-zone/current?userId=${resolvedUserId}&ts=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        setZone(null);
        setSpawn(null);
        setNextSpawnAt(null);
        if (data?.expired) setMessage('Your Safari Zone run expired. Start a new one to keep exploring.');
        return;
      }
      setZone(data.safariZone || null);
      setSpawn(data.spawn || null);
      setNextSpawnAt(data.nextSpawnAt || null);
    } finally {
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
    }, 1000);
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
    try {
      const response = await fetch('/api/safari-zone/catch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Safari Zone catch failed');
      setSpawn(null);
      setNextSpawnAt(data.nextSpawnAt || null);
      setMessage(data.message || (data.caught ? 'Caught!' : 'It got away!'));
    } catch (error) {
      setMessage(error.message || 'Safari Zone catch failed');
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
            <CardContent className="space-y-4">
              <p className="text-emerald-100/80">Spend {SAFARI_ZONE_COST} points to roll a random biome and begin a private Safari Zone session.</p>
              <ul className="list-disc pl-6 text-sm text-emerald-100/70 space-y-1">
                <li>Instanced per user</li>
                <li>Pokémon respawn every 20 to 60 seconds</li>
                <li>1/1000 shiny odds</li>
                <li>3 Poké Snacks per run for bonus catch rate</li>
              </ul>
              <Button onClick={enterSafariZone} disabled={loading || actionLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                {actionLoading ? 'Entering...' : `Enter Safari Zone (${SAFARI_ZONE_COST})`}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border border-emerald-400/40 bg-slate-900/60 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-2xl text-emerald-300">{zone.biomeName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-emerald-100/80">{zone.biomeDescription}</p>

                </CardContent>
              </Card>
              <Card className="border border-yellow-400/40 bg-slate-900/60">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-300 font-bold"><Candy className="h-4 w-4" /> Poké Snacks: {zone.snacksRemaining ?? 0}</div>
                  <div className="flex items-center gap-2 text-cyan-300 font-bold"><Sparkles className="h-4 w-4" /> Shiny Odds: 1 / 1000</div>
                  {countdown && <div className="flex items-center gap-2 text-emerald-200 font-bold"><Clock className="h-4 w-4" /> Next spawn in {countdown}</div>}
                </CardContent>
              </Card>
            </div>

            {spawn ? (
              <Card className="border-2 border-emerald-400/50 bg-slate-900/70">
                <CardContent className="py-8 text-center space-y-4">
                  <img src={spawn.sprite} alt={spawn.displayName} className="mx-auto h-48 w-48 object-contain" />
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
                      {spawn.isShiny && <span className="text-yellow-300">✨</span>}
                      {spawn.displayName}
                      <span className="text-cyan-300 text-base font-semibold">Lv {spawn.level || 1}</span>
                    </h2>
                    <p className="text-emerald-100/70 capitalize">Safari rarity: {spawn.safariRarity}</p>
                    <p className="text-yellow-200 font-semibold">Catch rate: {spawn.catchRate}% {spawn.snackApplied ? '(Snack boosted)' : ''}</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {(spawn.types || []).map((type) => (
                        <Badge key={type} className={`${getTypeColor(type)} text-white capitalize`}>{type}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={catchPokemon} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
                      {actionLoading ? 'Throwing...' : 'Catch Pokémon'}
                    </Button>
                    <Button onClick={useSnack} disabled={actionLoading || (zone.snacksRemaining ?? 0) <= 0 || spawn.snackApplied} className="bg-yellow-600 hover:bg-yellow-500 font-bold text-black">
                      Use Poké Snack
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-emerald-400/40 bg-slate-900/60">
                <CardContent className="py-10 text-center space-y-2">
                  <Clock className="mx-auto h-10 w-10 text-emerald-300" />
                  <p className="text-xl font-bold text-white">Waiting for the next Safari Zone spawn...</p>
                  {countdown && <p className="text-emerald-200">Next encounter in {countdown}</p>}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
