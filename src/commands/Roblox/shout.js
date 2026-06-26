import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('shout')
    .setDescription('📢 Send an announcement with embed and ping @everyone')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message text before the embed (e.g., 📢 ANNOUNCEMENT)')
        .setRequired(true)
        .setMaxLength(2000))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed title')
        .setRequired(true)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed description')
        .setRequired(true)
        .setMaxLength(4000))
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Upload an image (optional)')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send the announcement')
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
      const messageText = interaction.options.getString('message');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const attachment = interaction.options.getAttachment('image');
      const targetChannel = interaction.options.getChannel('channel');

      // Verificar permisos del bot
      const botMember = await targetChannel.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
        return await interaction.editReply({
          content: `❌ I don't have permission to send messages in <#${targetChannel.id}>.`,
        });
      }

      // ─── CONSTRUIR EMBED ──────────────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(0x3F3F3F)
        .setTitle(`📢 ${title}`)
        .setDescription(description)
        .setTimestamp();

      if (attachment && attachment.contentType?.startsWith('image/')) {
        embed.setImage(attachment.proxyURL || attachment.url);
      }

      // ─── ENVIAR MENSAJE CON @everyone ───────────────────────────────────

      const messageContent = `${messageText} @everyone`;

      await targetChannel.send({
        content: messageContent,
        embeds: [embed],
      });

      // ─── RESPUESTA AL STAFF ─────────────────────────────────────────────

      await interaction.editReply({
        content: `✅ Announcement successfully sent to <#${targetChannel.id}>`,
      });

      logger.info(`[Shout] ${interaction.user.tag} sent announcement to ${targetChannel.id}`);

    } catch (error) {
      logger.error('Shout error:', error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred while sending the announcement.',
        });
      } catch {
        await interaction.reply({
          content: '❌ An error occurred while sending the announcement.',
          ephemeral: true,
        });
      }
    }
  },
};
