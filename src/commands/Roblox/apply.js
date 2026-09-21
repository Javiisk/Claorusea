import { SlashCommandBuilder } from 'discord.js';
import { startApplication } from '../../utils/applyHandlers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply for a staff position')
    .setDMPermission(false),

  async execute(interaction) {
    await startApplication(interaction);
  },
};
