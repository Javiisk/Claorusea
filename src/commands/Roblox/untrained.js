import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

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
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0, blacklisted: false }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function getRobloxUserByDiscord(discordId) {
  try {
    const url = `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': BLOXLINK_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data || !data.robloxID) return null;
    
    return data;
  } catch (error) {
    logger.error(`[Untrained] Error: ${error.message}`);
    return null;
  }
}

async function getRobloxUsernameById(userId) {
  try {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(id)) return null;
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.name || null;
  } catch {
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('untrained')
    .setDescription('Mark a user as untrained ❌')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to mark as untrained')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Untrained interaction defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);
      if (!bloxlinkData || !bloxlinkData.robloxID) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = bloxlinkData.robloxID;
      let robloxUsername = bloxlinkData.primaryAccount || null;
      
      if (!robloxUsername || robloxUsername === 'Unknown') {
        const username = await getRobloxUsernameById(robloxId);
        if (username) robloxUsername = username;
      }

      if (!robloxUsername) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not get Roblox username for **${targetUser.tag}**.`,
        });
      }

      saveUser(robloxUsername, { trained: false });

      const embed = createEmbed({ title: '❌ User Untrained', description: null })
        .setDescription(`**${robloxUsername}** (${targetUser.tag}) has been marked as **Untrained**.`)
        .setColor(0xED4245)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('Untrained command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
