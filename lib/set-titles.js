import { getTrainerRank, TRAINER_RANKS } from '@/lib/trainer-ranks';

export function normalizeUnlockedTitles(unlockedTitles = []) {
  return (unlockedTitles || []).filter((title) => {
    if (!title?.id) return false;
    if (title.source === 'set') return false;
    if (/^set-(?:full|master|complete)-/.test(title.id)) return false;
    return true;
  });
}

export function normalizeSelectedTitleId(selectedTitleId = null) {
  if (!selectedTitleId) return null;
  if (/^set-(?:full|master|complete)-/.test(selectedTitleId)) {
    return null;
  }
  return selectedTitleId;
}

export function slugifyTitleLabel(label = '') {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildBattleRankTitles(battleWins = 0) {
  const wins = Number.isFinite(Number(battleWins)) ? Number(battleWins) : 0;
  return TRAINER_RANKS.slice().reverse()
    .filter((rank) => wins >= rank.minWins)
    .map((rank) => ({
      id: `rank-${slugifyTitleLabel(rank.label)}`,
      source: 'battle-rank',
      tier: 'rank',
      label: rank.label,
      description: `Unlocked by reaching ${rank.minWins} battle wins.`,
      textClass: rank.textClass,
      badgeClass: rank.badgeClass,
    }));
}

export function mergeSpecialTitlesForUsername(username = '', unlockedTitles = []) {
  const normalized = String(username || '').trim().toLowerCase();
  const titleMap = new Map(normalizeUnlockedTitles(unlockedTitles).map((title) => [title.id, title]));

  if (normalized === 'grant') {
    titleMap.set('special-spheal-of-approval', {
      id: 'special-spheal-of-approval',
      source: 'special',
      tier: 'special',
      label: 'Spheal of Approval',
      description: 'A unique honorary title for Grant.',
      color: '#d9f1f1',
      textClass: '',
      badgeClass: 'bg-[#d9f1f1]/20 text-white border-[#d9f1f1]/40',
    });

    titleMap.set('special-cosmic-cypher', {
      id: 'special-cosmic-cypher',
      source: 'special',
      tier: 'special',
      label: 'Cosmic Cypher',
      description: 'A unique honorary title for Grant.',
      color: '#35063e',
      textClass: '',
      badgeClass: 'bg-[#35063e]/20 text-white border-[#35063e]/40',
    });
  }

  if (normalized === 'pickles') {
    titleMap.set('special-maus-hunter', {
      id: 'special-maus-hunter',
      source: 'special',
      tier: 'special',
      label: 'Maus Hunter',
      description: 'A unique honorary title for Pickles.',
      color: '#f0f8ff',
      textClass: '',
      badgeClass: 'bg-[#f0f8ff]/20 text-white border-[#f0f8ff]/40',
    });
  }

  return Array.from(titleMap.values());
}

export function getAllAvailableTitles({ battleWins = 0, unlockedTitles = [] } = {}) {
  const rankTitles = buildBattleRankTitles(battleWins);
  const titleMap = new Map();
  [...rankTitles, ...normalizeUnlockedTitles(unlockedTitles)].forEach((title) => {
    if (title?.id) titleMap.set(title.id, title);
  });
  return Array.from(titleMap.values());
}

export function getSelectedUnlockedTitle(unlockedTitles = [], selectedTitleId = null, battleWins = 0) {
  const normalizedSelectedTitleId = normalizeSelectedTitleId(selectedTitleId);
  if (!normalizedSelectedTitleId) return null;
  return getAllAvailableTitles({ battleWins, unlockedTitles }).find((title) => title?.id === normalizedSelectedTitleId) || null;
}

export function getActiveDisplayTitle({ battleWins = 0, unlockedTitles = [], selectedTitleId = null } = {}) {
  const selectedTitle = getSelectedUnlockedTitle(unlockedTitles, selectedTitleId, battleWins);
  if (selectedTitle) return selectedTitle;
  return getTrainerRank(battleWins);
}
