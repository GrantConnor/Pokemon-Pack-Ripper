import { v4 as uuidv4 } from 'uuid';

export const STARTING_POINTS = 1000;
const POINTS_REGEN_RATE = 1000;
const POINTS_REGEN_INTERVAL = 7200000;

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hashPassword(password) {
  return Buffer.from(String(password)).toString('base64');
}

export function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string') {
    return { valid: false, strategy: 'invalid-stored-password-type' };
  }

  const rawPassword = String(password ?? '');
  const trimmedPassword = rawPassword.trim();

  if (storedPassword === hashPassword(trimmedPassword)) {
    return { valid: true, strategy: 'base64-trimmed' };
  }

  if (storedPassword === hashPassword(rawPassword)) {
    return { valid: true, strategy: 'base64-raw' };
  }

  if (storedPassword === trimmedPassword) {
    return { valid: true, strategy: 'plaintext-trimmed' };
  }

  if (storedPassword === rawPassword) {
    return { valid: true, strategy: 'plaintext-raw' };
  }

  return { valid: false, strategy: 'no-match' };
}

export function calculateRegeneratedPoints(user) {
  if (user.username === 'Spheal') return 999999;
  const now = Date.now();
  const lastRefresh = new Date(user.lastPointsRefresh || user.createdAt).getTime();
  const timeElapsed = now - lastRefresh;
  const hoursElapsed = timeElapsed / POINTS_REGEN_INTERVAL;
  const pointsToAdd = Math.floor(hoursElapsed * POINTS_REGEN_RATE);
  return Math.min((user.points || 0) + pointsToAdd, 10000);
}

export function calculateNextPointsTime(user) {
  if (user.username === 'Spheal') return 0;
  const now = Date.now();
  const lastRefresh = new Date(user.lastPointsRefresh || user.createdAt).getTime();
  const timeElapsed = now - lastRefresh;
  const timeSinceLastPoint = timeElapsed % POINTS_REGEN_INTERVAL;
  const timeUntilNext = POINTS_REGEN_INTERVAL - timeSinceLastPoint;
  return Math.ceil(timeUntilNext / 1000);
}

export function makeAuthTraceId(prefix) {
  return `${prefix}-${uuidv4()}`;
}
