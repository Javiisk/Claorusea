// src/utils/presence.js
import { ActivityType } from 'discord.js';

// Maps a friendly string (used in the env var and the slash command) to the
// actual discord.js ActivityType enum value.
const ACTIVITY_TYPES = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom, // Renders with NO verb prefix, just the text.
};

/**
 * Sets the bot's presence/activity (the "Watching X" text under its name).
 *
 * @param {import('discord.js').Client} client
 * @param {string} text - The status text, e.g. "Patients and messages".
 * @param {string} [type='watching'] - One of: playing, watching, listening, competing, custom.
 */
export function applyPresence(client, text, type = 'watching') {
  const activityType = ACTIVITY_TYPES[type.toLowerCase()] ?? ActivityType.Watching;

  client.user.setPresence({
    activities: [{ name: text, type: activityType }],
    status: 'online',
  });

  console.log(`✅ Presence updated: [${type}] ${text}`);
}
