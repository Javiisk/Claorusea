// src/utils/economyStorage.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ECONOMY_PATH = join(__dirname, '../../../economy.json');

function loadDB() {
  if (!existsSync(ECONOMY_PATH)) writeFileSync(ECONOMY_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(ECONOMY_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(ECONOMY_PATH, JSON.stringify(data, null, 2));
}

const DEFAULT_USER = {
  coins: 0,
  xp: 0,
  ascension: 0,
  job: null,
  lastWork: 0,
  lastFish: 0,
  lastMine: 0,
  lastRob: 0,
  lastMessageXp: 0,
  inventory: { pickaxe: false, fishingrod: false },
};

export function getUserData(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = { ...DEFAULT_USER, inventory: { ...DEFAULT_USER.inventory } };
    saveDB(db);
  }
  // Merge in any new default fields added later (safe upgrade path).
  return { ...DEFAULT_USER, ...db[userId], inventory: { ...DEFAULT_USER.inventory, ...db[userId].inventory } };
}

export function saveUserData(userId, data) {
  const db = loadDB();
  db[userId] = data;
  saveDB(db);
}
