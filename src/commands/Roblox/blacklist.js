import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0 }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist or unblacklist a user 🚫')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox username').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason (leave empty to remove blacklist)').setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Blacklist interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'blacklist' });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const reason = interaction.options.getString('reason');
      const roblox = await getRobloxUser(username);
      if (!roblox) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Roblox user not found.' });

      if (!reason) {
        saveUser(roblox.name, { blacklisted: false, blacklistReason: null });
        const embed = createEmbed({ title: '✅ Blacklist Removed', description: null })
          .setDescription(`**${roblox.name}** has been removed from the blacklist.`)
          .setColor(0x57F287).setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      saveUser(roblox.name, { blacklisted: true, blacklistReason: reason });
      const embed = createEmbed({ title: '🚫 User Blacklisted', description: null })
        .setDescription(`**${roblox.name}** has been blacklisted.\n**Reason:** ${reason}`)
        .setColor(0xED4245).setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Blacklist command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};
