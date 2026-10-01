// src/utils/hoursStorage.js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const STORAGE_PATH = join(DATA_DIR, 'hours-data.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(STORAGE_PATH)) writeFileSync(STORAGE_PATH, JSON.stringify({}));

function load() {
  try { return JSON.parse(readFileSync(STORAGE_PATH, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
}

export function getLastResetTimestamp() {
  const now = new Date();
  const gmt6 = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const lastSunday = new Date(gmt6);
  lastSunday.setUTCHours(20 + 6, 0, 0, 0);
  const day = gmt6.getUTCDay();
  const daysBack = day === 0 && gmt6.getUTCHours() >= 20 ? 0 : (day === 0 ? 7 : day);
  lastSunday.setUTCDate(gmt6.getUTCDate() - daysBack);
  lastSunday.setUTCHours(2, 0, 0, 0);

  return lastSunday.getTime();
}

export function getHoursData(discordId) {
  const data = load();
  const lastReset = getLastResetTimestamp();
  let user = data[discordId] || {
    weeklyMinutes: 0,
    lastSessionMinutes: 0,
    lastJoinTimestamp: null,
    sessionStart: null,
    lastReset: lastReset,
  };

  if (!user.lastReset || user.lastReset < lastReset) {
    user.weeklyMinutes = 0;
    user.lastReset = lastReset;
    data[discordId] = user;
    save(data);
  }

  return user;
}

export function saveHoursData(discordId, userData) {
  const data = load();
  data[discordId] = userData;
  save(data);
}

export function startSession(discordId) {
  const user = getHoursData(discordId);
  user.sessionStart = Date.now();
  user.lastJoinTimestamp = Date.now();
  saveHoursData(discordId, user);
}

export function endSession(discordId) {
  const user = getHoursData(discordId);
  if (!user.sessionStart) return null;

  const durationMin = Math.floor((Date.now() - user.sessionStart) / 60000);
  user.weeklyMinutes = (user.weeklyMinutes || 0) + durationMin;
  user.lastSessionMinutes = durationMin;
  user.sessionStart = null;
  saveHoursData(discordId, user);

  return durationMin;
}

export function addHeartbeatMinutes(discordId, minutes) {
  const user = getHoursData(discordId);
  user.weeklyMinutes = (user.weeklyMinutes || 0) + minutes;
  saveHoursData(discordId, user);
}

// ─── GET ALL USERS (for /eligibles, leaderboards, etc.) ──────────────────
export function getAllUsers() {
  return load();
}