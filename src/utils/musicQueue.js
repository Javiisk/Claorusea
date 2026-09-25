// src/utils/musicQueue.js

// In-memory queue per guild — music state doesn't need to survive restarts.
const queues = new Map();

export function getQueue(guildId) {
  return queues.get(guildId);
}

export function createQueue(guildId, data) {
  queues.set(guildId, data);
  return data;
}

export function deleteQueue(guildId) {
  queues.delete(guildId);
}
