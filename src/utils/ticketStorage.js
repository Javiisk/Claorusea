// src/utils/ticketStorage.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TICKETS_PATH = join(__dirname, '../../../tickets.json');

function loadDB() {
  if (!existsSync(TICKETS_PATH)) writeFileSync(TICKETS_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(TICKETS_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(TICKETS_PATH, JSON.stringify(data, null, 2));
}

// Tickets are keyed by their channel ID.
export function createTicketRecord(channelId, data) {
  const db = loadDB();
  db[channelId] = data;
  saveDB(db);
}

export function getTicketRecord(channelId) {
  const db = loadDB();
  return db[channelId] || null;
}

export function updateTicketRecord(channelId, patch) {
  const db = loadDB();
  if (!db[channelId]) return null;
  db[channelId] = { ...db[channelId], ...patch };
  saveDB(db);
  return db[channelId];
}

export function deleteTicketRecord(channelId) {
  const db = loadDB();
  delete db[channelId];
  saveDB(db);
}
