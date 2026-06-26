import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';

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
    .addStringOption(option =>
      option.setName('media')
        .setDescription('Image or video URL (Imgur, YouTube, Discord CDN)')
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
      let mediaUrl = interaction.options.getString('media');
      const targetChannel = interaction.options.getChannel('channel');

      if (!isValidUrl(mediaUrl)) {
        return await interaction.editReply({
          content: '❌ Invalid URL. Please provide a valid image or video link.',
        });
      }

      // ─── LIMPIAR URL DE DISCORD ──────────────────────────────────────────

      if (mediaUrl.includes('cdn.discordapp.com')) {
        // Buscar extensiones de archivo y cortar ahí
        const match = mediaUrl.match(/(.*\.(mp4|webm|mov|png|jpg|jpeg|gif|webp))/i);
        if (match) {
          mediaUrl = match[1];
        } else {
          mediaUrl = mediaUrl.split('?')[0];
        }
        // Si termina en '&', quitarlo
        if (mediaUrl.endsWith('&')) {
          mediaUrl = mediaUrl.slice(0, -1);
        }
      }

      // Verificar permisos
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
        .setTitle(`${title}`)
        .setDescription(description)
        .setFooter({ 
          text: `Sneak peek sent by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // ─── DETECTAR TIPO DE ENLACE ────────────────────────────────────────

      const isDirectVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(mediaUrl);
      const isImgur = mediaUrl.includes('imgur.com');
      const isYouTube = mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be');
      const isStreamable = mediaUrl.includes('streamable.com');

      if (isDirectVideo) {
        embed.setImage(mediaUrl);
      } else if (isImgur) {
        embed.setImage(mediaUrl);
      } else if (isYouTube || isStreamable) {
        embed.addFields({
          name: '🎥 Watch the sneak peek',
          value: `[Click here to watch](${mediaUrl})`,
          inline: false,
        });
      } else {
        embed.setImage(mediaUrl);
      }

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

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
