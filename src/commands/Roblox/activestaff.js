import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

// Show staff active in the last 48 hours
const HOURS_THRESHOLD = 48;

function loadDB() {
  if (!existsSync(DB_PATH)) return {};
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

export default {
  data: new SlashCommandBuilder()
    .setName('activestaff')
    .setDescription('Displays staff members who have been active in the last 48 hours.')
    .setDMPermission(false),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Activestaff interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'activestaff',
      });
      return;
    }

    try {
      const db = loadDB();
      const now = Date.now();
      const threshold = now - HOURS_THRESHOLD * 60 * 60 * 1000;

      const activeStaff = Object.values(db).filter(user => {
        return user.lastShift && new Date(user.lastShift).getTime() > threshold;
      });

      if (activeStaff.length === 0) {
        const embed = createEmbed({ title: '🟡 Active Staff', description: null })
          .setDescription(`No staff members have been active in the last **${HOURS_THRESHOLD} hours**.`)
          .setColor(0xfee75c)
          .setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // Sort by most recent shift first
      activeStaff.sort((a, b) => new Date(b.lastShift) - new Date(a.lastShift));

      const embed = createEmbed({ title: '🟢 Active Staff', description: null })
        .setDescription(`Staff members active in the last **${HOURS_THRESHOLD} hours** — **${activeStaff.length}** total.`)
        .setColor(0x57f287)
        .setTimestamp();

      for (const user of activeStaff.slice(0, 25)) {
        const lastShiftTs = Math.floor(new Date(user.lastShift).getTime() / 1000);
        embed.addFields({
          name: user.username ?? 'Unknown',
          value: `Last shift: <t:${lastShiftTs}:R>`,
          inline: true,
        });
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Activestaff command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching active staff.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
