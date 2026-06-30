import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673879069393024',
  '1505673808097574912',
];

const PING_ROLE_ID = '1513330537798959135';

export default {
  data: new SlashCommandBuilder()
    .setName('sneakpeak')
    .setDescription('👀 Send a sneak peek with image and ping the role')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Sneak peek title')
        .setRequired(true)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Sneak peek description')
        .setRequired(true)
        .setMaxLength(4000))
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Upload an image')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send the sneak peek')
        .setRequired(true)
        .addChannelTypes(0, 5)),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const attachment = interaction.options.getAttachment('image');
      const targetChannel = interaction.options.getChannel('channel');

      // Verificar que sea una imagen
      if (!attachment.contentType?.startsWith('image/')) {
        return await interaction.editReply({
          content: '❌ The file must be an image.',
        });
      }

      // Verificar permisos del bot
      const botMember = await targetChannel.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel') || !permissions.has('AttachFiles')) {
        return await interaction.editReply({
          content: `❌ I don't have permission to send messages in <#${targetChannel.id}>.`,
        });
      }

      // ─── CONSTRUIR EMBED ──────────────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(0x3F3F3F)
        .setTitle(`${title}`)
        .setDescription(description)
        .setImage(attachment.proxyURL || attachment.url)
        .setTimestamp();

      // ─── ENVIAR MENSAJE ──────────────────────────────────────────────────

      const roleMention = `<@&${PING_ROLE_ID}>`;
      const messageContent = `${roleMention}`;

      await targetChannel.send({
        content: messageContent,
        embeds: [embed],
      });

      await interaction.editReply({
        content: `✅ Sneak peek successfully sent to <#${targetChannel.id}>`,
      });

      logger.info(`[SneakPeek] ${interaction.user.tag} sent sneak peek to ${targetChannel.id}`);

    } catch (error) {
      logger.error('SneakPeek error:', error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred while sending the sneak peek.',
        });
      } catch {
        await interaction.reply({
          content: '❌ An error occurred while sending the sneak peek.',
          ephemeral: true,
        });
      }
    }
  },
};
