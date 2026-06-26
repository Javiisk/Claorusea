import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
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
    .setName('embedmessage')  // ← CAMBIADO a embedmessage
    .setDescription('🎨 Create a custom embed and send it to a specific channel')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed title')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed description')
        .setRequired(false)
        .setMaxLength(4000))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Hex color (e.g., #FF5733, RED, BLUE)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('thumbnail')
        .setDescription('Thumbnail image URL')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('image')
        .setDescription('Large image URL')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('Footer text')
        .setRequired(false)
        .setMaxLength(2048))
    .addStringOption(option =>
      option.setName('footer_icon')
        .setDescription('Footer icon URL')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('author')
        .setDescription('Author text')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('author_icon')
        .setDescription('Author icon URL')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('url')
        .setDescription('URL the title redirects to')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('📌 Channel where the embed will be sent')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ 
        content: '❌ You don\'t have permission to use this command.', 
        ephemeral: true 
      });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('EmbedMessage interaction defer failed', { 
        userId: interaction.user.id, 
        guildId: interaction.guildId, 
        commandName: 'embedmessage' 
      });
      return;
    }

    try {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const colorInput = interaction.options.getString('color');
      const thumbnail = interaction.options.getString('thumbnail');
      const image = interaction.options.getString('image');
      const footer = interaction.options.getString('footer');
      const footerIcon = interaction.options.getString('footer_icon');
      const author = interaction.options.getString('author');
      const authorIcon = interaction.options.getString('author_icon');
      const url = interaction.options.getString('url');
      const targetChannel = interaction.options.getChannel('channel');

      if (!targetChannel) {
        return await InteractionHelper.safeEditReply(interaction, { 
          content: '❌ Specified channel not found.' 
        });
      }

      const botMember = await targetChannel.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ I don't have permission to send messages in <#${targetChannel.id}>.`
        });
      }

      const embed = createEmbed({ 
        title: title || '📋 Custom Embed',
        description: description || 'No description provided.'
      });

      if (colorInput) {
        const colorMap = {
          'red': '#FF0000',
          'blue': '#0000FF',
          'green': '#00FF00',
          'yellow': '#FFFF00',
          'purple': '#800080',
          'orange': '#FFA500',
          'pink': '#FFC0CB',
          'white': '#FFFFFF',
          'black': '#000000',
          'grey': '#808080',
          'gray': '#808080'
        };
        let hexColor = colorMap[colorInput.toLowerCase()] || colorInput;
        if (!hexColor.startsWith('#')) hexColor = `#${hexColor}`;
        try {
          embed.setColor(parseInt(hexColor.replace('#', ''), 16));
        } catch {
          embed.setColor(0x5865F2);
        }
      } else {
        embed.setColor(0x5865F2);
      }

      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
      if (footer) embed.setFooter({ text: footer, iconURL: footerIcon || null });
      if (author) embed.setAuthor({ name: author, iconURL: authorIcon || null });
      if (url) embed.setURL(url);

      embed.setTimestamp();

      await targetChannel.send({ embeds: [embed] });

      await InteractionHelper.safeEditReply(interaction, { 
        content: `✅ Embed successfully sent to <#${targetChannel.id}>` 
      });

      logger.info(`[EmbedMessage] User ${interaction.user.tag} sent embed to channel ${targetChannel.id}`);

    } catch (error) {
      logger.error('EmbedMessage command error:', error);
      try { 
        return await InteractionHelper.safeReply(interaction, { 
          content: '❌ An error occurred while creating the embed.' 
        }); 
      } catch (e) { 
        logger.error('Failed:', e); 
      }
    }
  },
};
