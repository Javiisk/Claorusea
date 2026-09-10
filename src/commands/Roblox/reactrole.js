import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { parseEmojiInput, addReactRole } from '../../utils/reactroles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reactrole')
    .setDescription('Sets up a reaction role on an existing message')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel where the message is')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('The ID of the message to react to')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('emoji')
        .setDescription('The emoji to react with (unicode or custom server emoji)')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The role to give when someone reacts with that emoji')
        .setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    try {
      const channel = interaction.options.getChannel('channel');
      const messageId = interaction.options.getString('message');
      const emojiInput = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const message = await channel.messages.fetch(messageId).catch(() => null);

      if (!message) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not find a message with ID \`${messageId}\` in ${channel}.`,
        });
      }

      const { reactValue, matchValue } = parseEmojiInput(emojiInput);

      try {
        await message.react(reactValue);
      } catch (reactError) {
        logger.error('[ReactRole] Failed to react to the message:', reactError.message);
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not react with that emoji. Make sure it\'s a valid emoji (and that I have access to it, if it\'s a custom one).',
        });
      }

      addReactRole(message.id, matchValue, role.id);

      logger.info(`[ReactRole] ${interaction.user.tag} linked ${emojiInput} → ${role.name} on message ${message.id}`);

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Done! Reacting with ${emojiInput} on [that message](${message.url}) now gives the **${role.name}** role.`,
      });

    } catch (error) {
      logger.error('Reactrole command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while setting up the reaction role.',
      });
    }
  },
};
