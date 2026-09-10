// src/utils/reactroles.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../reactroles.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Turns whatever the user typed for the emoji option into two things:
 * - reactValue: what to pass to message.react()
 * - matchValue: what to compare against later when someone reacts
 * Handles both unicode emojis (😀) and custom server emojis (<:name:id> / <a:name:id>).
 */
export function parseEmojiInput(emojiInput) {
  const customMatch = emojiInput.match(/^<a?:\w+:(\d+)>$/);
  if (customMatch) {
    const id = customMatch[1];
    return { reactValue: id, matchValue: id };
  }
  return { reactValue: emojiInput, matchValue: emojiInput };
}

/**
 * Saves a new reaction-role link for a message. A single message can have
 * several emoji → role links (add more with more /reactrole calls on the
 * same message).
 */
export function addReactRole(messageId, matchValue, roleId) {
  const db = loadDB();
  if (!db[messageId]) db[messageId] = [];

  // Replace an existing entry for the same emoji instead of duplicating it.
  db[messageId] = db[messageId].filter(entry => entry.match !== matchValue);
  db[messageId].push({ match: matchValue, roleId });

  saveDB(db);
}

export function getReactRoles(messageId) {
  const db = loadDB();
  return db[messageId] || null;
}

/**
 * Called on messageReactionAdd — gives the role if this message/emoji
 * combo is configured.
 */
export async function handleReactionAdd(reaction, user) {
  if (user.bot) return;

  if (reaction.partial) {
    const fetched = await reaction.fetch().catch(() => null);
    if (!fetched) return;
    reaction = fetched;
  }

  const config = getReactRoles(reaction.message.id);
  if (!config) return;

  const emojiKey = reaction.emoji.id || reaction.emoji.name;
  const entry = config.find(c => c.match === emojiKey);
  if (!entry) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.add(entry.roleId).catch((error) => {
    console.error(`❌ [ReactRole] Failed to add role to ${user.tag}:`, error.message);
  });
}

/**
 * Called on messageReactionRemove — takes the role away when the person
 * removes their reaction.
 */
export async function handleReactionRemove(reaction, user) {
  if (user.bot) return;

  if (reaction.partial) {
    const fetched = await reaction.fetch().catch(() => null);
    if (!fetched) return;
    reaction = fetched;
  }

  const config = getReactRoles(reaction.message.id);
  if (!config) return;

  const emojiKey = reaction.emoji.id || reaction.emoji.name;
  const entry = config.find(c => c.match === emojiKey);
  if (!entry) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(entry.roleId).catch((error) => {
    console.error(`❌ [ReactRole] Failed to remove role from ${user.tag}:`, error.message);
  });
}
