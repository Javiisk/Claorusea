import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, warnings: 0, blacklisted: false }), ...data };
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
    .setName('trained')
    .setDescription('Mark user has trained ✅')
    .addStringOption(opt =>
      opt.setName('user').setDescription('User of roblox').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Trained interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'trained',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const roblox = await getRobloxUser(username);

      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Error fetching user.',
        });
      }

      saveUser(roblox.name, { trained: true });

      const embed = createEmbed({ title: '✅ User trained', description: null })
        .setDescription(`**${roblox.name}** has been marked as **Trained**.`)
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Trained command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ Error trying at mark it as trained.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
