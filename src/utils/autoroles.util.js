// src/utils/autoroles.js
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../autoroles.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Saves a new autorole panel config, keyed by a unique panel ID (used in
 * the select menu's customId so we know which config to apply later).
 */
export function saveAutorolePanel(panelId, roleIds, multiple) {
  const db = loadDB();
  db[panelId] = { roleIds, multiple };
  saveDB(db);
}

export function getAutorolePanel(panelId) {
  const db = loadDB();
  return db[panelId] || null;
}

/**
 * Applies the result of a select menu interaction: adds the roles the
 * member picked, removes the ones from this panel they didn't pick.
 */
export async function handleAutoroleSelect(interaction) {
  const panelId = interaction.customId.replace('autorole_select_', '');
  const panel = getAutorolePanel(panelId);

  if (!panel) {
    return interaction.reply({
      content: '❌ This role menu is no longer configured.',
      ephemeral: true,
    });
  }

  const selectedValues = interaction.values; // role IDs the user picked
  const member = interaction.member;

  const added = [];
  const removed = [];

  for (const roleId of panel.roleIds) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) continue;

    const hasRole = member.roles.cache.has(roleId);
    const isSelected = selectedValues.includes(roleId);

    try {
      if (isSelected && !hasRole) {
        await member.roles.add(roleId);
        added.push(role.name);
      } else if (!isSelected && hasRole) {
        await member.roles.remove(roleId);
        removed.push(role.name);
      }
    } catch (error) {
      console.error(`❌ Failed to update role ${role.name} for ${member.user.tag}:`, error.message);
    }
  }

  const lines = [];
  if (added.length) lines.push(`✅ Added: **${added.join(', ')}**`);
  if (removed.length) lines.push(`➖ Removed: **${removed.join(', ')}**`);
  if (!lines.length) lines.push('No changes made.');

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}
