// src/utils/bugFeedbackStorage.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEEDBACK_PATH = join(__dirname, '../../../bugFeedback.json');

function loadDB() {
  if (!existsSync(FEEDBACK_PATH)) writeFileSync(FEEDBACK_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(FEEDBACK_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

// Keyed by the DM message ID that carries the star-rating buttons.
export function createFeedbackRequest(messageId, data) {
  const db = loadDB();
  db[messageId] = data;
  saveDB(db);
}

export function getFeedbackRequest(messageId) {
  const db = loadDB();
  return db[messageId] || null;
}

export function deleteFeedbackRequest(messageId) {
  const db = loadDB();
  delete db[messageId];
  saveDB(db);
}
