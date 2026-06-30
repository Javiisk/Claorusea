import { SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
];

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot send a message in this channel. (Staff only)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('message').setDescription('Message to send').setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    const message = interaction.options.getString('message');

    try {
      // Send the message publicly in the channel
      await interaction.channel.send(message);

      // Confirm to the admin (ephemeral, only they see it)
      await interaction.reply({
        content: '✅ Message sent.',
        ephemeral: true,
      });

      logger.info(`Say command used by ${interaction.user.tag} in ${interaction.channel.name}: ${message}`);
    } catch (error) {
      logger.error('Say command error:', error.message, error.stack);
      try {
        await interaction.reply({
          content: '❌ An error occurred while sending the message.',
          ephemeral: true,
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
