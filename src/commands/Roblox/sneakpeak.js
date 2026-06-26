import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const PING_ROLE_ID = '1513330537798959135';

export default {
  data: new SlashCommandBuilder()
    .setName('sneakpeak')
    .setDescription('👀 Send a sneak peek with image/video and ping the role')
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
      option.setName('file')
        .setDescription('Image or video for the sneak peek')
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

    // ⚠️ NO USAR safeDefer - responder inmediatamente
    await interaction.reply({
      content: '⏳ Sending sneak peek...',
      ephemeral: true,
    });

    try {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const attachment = interaction.options.getAttachment('file');
      const targetChannel = interaction.options.getChannel('channel');

      // Validate file is image or video
      const allowedTypes = ['image/', 'video/'];
      const isAllowed = allowedTypes.some(type => attachment.contentType?.startsWith(type));
      
      if (!isAllowed) {
        return await interaction.editReply({
          content: '❌ The file must be an image or video.',
        });
      }

      // Check bot permissions in target channel
      const botMember = await targetChannel.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel') || !permissions.has('AttachFiles')) {
        return await interaction.editReply({
          content: `❌ I don't have permission to send messages or files in <#${targetChannel.id}>.`,
        });
      }

      // Build embed with color #3F3F3F
      const embed = new EmbedBuilder()
        .setColor(0x3F3F3F)
        .setTitle(`👀 ${title}`)
        .setDescription(description)
        .setImage(attachment.proxyURL || attachment.url) // Usar proxyURL para imágenes
        .setFooter({ 
          text: `Sneak peek sent by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Si es video, NO usar .setImage()
      const isVideo = attachment.contentType?.startsWith('video/');
      if (isVideo) {
        embed.setImage(null); // Quitar imagen del embed
      }

      // Archivos adjuntos (solo para videos)
      const files = isVideo ? [new AttachmentBuilder(attachment.url)] : [];

      // Enviar al canal con ping al rol
      const roleMention = `<@&${PING_ROLE_ID}>`;
      const messageContent = `🔔 **NEW SNEAK PEEK!** ${roleMention}`;

      await targetChannel.send({
        content: messageContent,
        embeds: [embed],
        files: files,
      });

      // Responder al staff
      await interaction.editReply({
        content: `✅ Sneak peek successfully sent to <#${targetChannel.id}>`,
      });

      logger.info(`[SneakPeek] ${interaction.user.tag} sent sneak peek to ${targetChannel.id}`);

    } catch (error) {
      logger.error('SneakPeek error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while sending the sneak peek.',
      });
    }
  },
};
