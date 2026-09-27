import { SlashCommandBuilder } from 'discord.js';
import { handleResolveThread } from '../../utils/bugForum.js';

export default {
  data: new SlashCommandBuilder()
    .setName('resolved')
    .setDescription('Marks the current bug report thread as resolved')
    .setDMPermission(false),

  async execute(interaction) {
    await handleResolveThread(interaction);
  },
};
