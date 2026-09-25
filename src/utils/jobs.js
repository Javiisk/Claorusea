// src/utils/jobs.js

// Each job: display label, coin range per /work, and cooldown in ms.
export const JOBS = {
  cashier: { label: 'Cashier', min: 50, max: 120, cooldownMs: 30 * 60 * 1000 },
  chef: { label: 'Chef', min: 80, max: 150, cooldownMs: 45 * 60 * 1000 },
  police: { label: 'Police Officer', min: 100, max: 200, cooldownMs: 40 * 60 * 1000 },
  developer: { label: 'Developer', min: 150, max: 300, cooldownMs: 60 * 60 * 1000 },
  streamer: { label: 'Streamer', min: 10, max: 400, cooldownMs: 60 * 60 * 1000 },
};

export function formatCooldown(msRemaining) {
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}
