import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAFF_PATH = join(__dirname, '../../../../staff-data.json');

function loadStaff() {
  if (!existsSync(STAFF_PATH)) return {};
  return JSON.parse(readFileSync(STAFF_PATH, 'utf8'));
}

export default {
  data: new SlashCommandBuilder()
    .setName('stafflist')
    .setDescription('Displays all registered staff members.')
    .setDMPermission(false),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Stafflist interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'stafflist',
      });
      return;
    }

    try {
      const staff = loadStaff();
      const members = Object.values(staff);

      if (members.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '📭 No staff members registered yet.',
        });
      }

      // Group by rank descending
      const sorted = members.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

      // Group by role name
      const grouped = {};
      for (const member of sorted) {
        const roleName = member.role ?? 'Unknown';
        if (!grouped[roleName]) grouped[roleName] = [];
        grouped[roleName].push(member.username);
      }

      const embed = createEmbed({ title: '👥 Staff List', description: null })
        .setDescription(`**Total Staff Members: ${members.length}**`)
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({ text: 'Use /registerstaff to add or remove staff members.' });

      for (const [role, usernames] of Object.entries(grouped)) {
        const value = usernames.map(u => `\`${u}\``).join(', ');
        embed.addFields({
          name: `${role} (${usernames.length})`,
          value: value.length > 1024 ? value.substring(0, 1020) + '...' : value,
          inline: false,
        });

        if (embed.data.fields.length >= 25) break;
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Stafflist command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching the staff list.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
