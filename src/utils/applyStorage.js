// src/utils/applyStorage.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLICATIONS_PATH = join(__dirname, '../../../applications.json');

function loadDB() {
  if (!existsSync(APPLICATIONS_PATH)) writeFileSync(APPLICATIONS_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(APPLICATIONS_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(APPLICATIONS_PATH, JSON.stringify(data, null, 2));
}

// Applications are keyed by the message ID of the logged application.
export function createApplicationRecord(messageId, data) {
  const db = loadDB();
  db[messageId] = data;
  saveDB(db);
}

export function getApplicationRecord(messageId) {
  const db = loadDB();
  return db[messageId] || null;
}

export function updateApplicationRecord(messageId, patch) {
  const db = loadDB();
  if (!db[messageId]) return null;
  db[messageId] = { ...db[messageId], ...patch };
  saveDB(db);
  return db[messageId];
}
