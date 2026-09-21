// src/utils/feedbackStorage.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEEDBACK_PATH = join(__dirname, '../../../feedback.json');

function loadDB() {
  if (!existsSync(FEEDBACK_PATH)) writeFileSync(FEEDBACK_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(FEEDBACK_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

// Feedback entries are keyed by the message ID of the ping message.
export function createFeedbackRecord(messageId, data) {
  const db = loadDB();
  db[messageId] = data;
  saveDB(db);
}

export function getFeedbackRecord(messageId) {
  const db = loadDB();
  return db[messageId] || null;
}
