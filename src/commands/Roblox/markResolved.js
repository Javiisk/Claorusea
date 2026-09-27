import { ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import { handleResolveThread } from '../../utils/bugForum.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Mark Resolved')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),

  async execute(interaction) {
    await handleResolveThread(interaction);
  },
};
