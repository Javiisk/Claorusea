// src/commands/Bot/status.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { applyPresence } from '../../utils/presence.js';

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Changes the bot's status/activity text")
    .addStringOption((option) =>
      option.setName('text').setDescription('The status text to display').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('The activity verb shown before the text')
        .setRequired(false)
        .addChoices(
          { name: 'Playing', value: 'playing' },
          { name: 'Watching', value: 'watching' },
          { name: 'Listening', value: 'listening' },
          { name: 'Competing', value: 'competing' },
          { name: 'Custom (no verb)', value: 'custom' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const text = interaction.options.getString('text');
    const type = interaction.options.getString('type') || 'watching';

    applyPresence(interaction.client, text, type);

    await interaction.reply({
      content: `✅ Status updated to **${type}: ${text}**`,
      ephemeral: true,
    });
  },
};
