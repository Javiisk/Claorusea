// src/utils/verifyStorage.js
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'verified-data.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));

function loadDB() {
  try { return JSON.parse(readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function saveVerifiedUser(discordId, robloxId, robloxUsername) {
  const db = loadDB();
  db[discordId] = { robloxId, robloxUsername, verifiedAt: Date.now() };
  saveDB(db);
}

export function getVerifiedUser(discordId) {
  const db = loadDB();
  return db[discordId] || null;
}