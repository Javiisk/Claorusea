import { SlashCommandBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('🎯 Test offer command')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('Roblox username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Rank to offer')
        .setRequired(true)
        .addChoices(
          { name: 'Trained', value: 'Trained' },
          { name: 'Untrained', value: 'Untrained' }
        )),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `✅ Offer command works! User: ${interaction.options.getString('user')}, Rank: ${interaction.options.getString('rank')}`,
      ephemeral: true,
    });
  },
};
