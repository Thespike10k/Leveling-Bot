export { logger } from './logger.js';
export { emoji } from './emoji.js';

export function formatXP(xp) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return String(xp);
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function progressBar(current, max, length = 12) {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function xpToNextLevel(level, totalXp, formula) {
  let spent = 0;
  for (let l = 0; l < level; l++) spent += formula(l);
  return formula(level) - (totalXp - spent);
}

export function levelFromXp(totalXp, formula) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= formula(level)) {
    remaining -= formula(level);
    level++;
  }
  return { level, remainingXp: remaining };
}

export function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
