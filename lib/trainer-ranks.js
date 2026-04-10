export const TRAINER_RANKS = [
  { minWins: 100, label: 'Champion', textClass: 'text-yellow-400', badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' },
  { minWins: 50, label: 'Elite Four', textClass: 'text-orange-400', badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/40' },
  { minWins: 25, label: 'Gym Leader', textClass: 'text-red-400', badgeClass: 'bg-red-500/20 text-red-300 border-red-400/40' },
  { minWins: 10, label: 'Pro Trainer', textClass: 'text-blue-400', badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/40' },
  { minWins: 5, label: 'Ace Trainer', textClass: 'text-purple-400', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40' },
  { minWins: 0, label: 'Trainer', textClass: 'text-white', badgeClass: 'bg-slate-500/20 text-slate-200 border-slate-400/40' },
];

export function getTrainerRank(battleWins = 0) {
  const wins = Number.isFinite(Number(battleWins)) ? Number(battleWins) : 0;
  return TRAINER_RANKS.find((rank) => wins >= rank.minWins) || TRAINER_RANKS[TRAINER_RANKS.length - 1];
}
