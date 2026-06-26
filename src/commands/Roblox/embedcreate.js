import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Staff role IDs
const STAFF_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912'
];

export default {
  data: new SlashCommandBuilder()
    .setName('embedcreate')
    .setDescription('🎨 Create a custom embed and send it to a specific channel')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Main options (11 options)
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
    // Fields: 4 campos × 3 opciones = 12 opciones (Total: 23 opciones ✅)
    .addStringOption(option =>
      option.setName('field1_name')
        .setDescription('Field 1 name')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('field1_value')
        .setDescription('Field 1 value')
        .setRequired(false)
        .setMaxLength(1024))
    .addBooleanOption(option =>
      option.setName('field1_inline')
        .setDescription('Field 1 inline?')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('field2_name')
        .setDescription('Field 2 name')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('field2_value')
        .setDescription('Field 2 value')
        .setRequired(false)
        .setMaxLength(1024))
    .addBooleanOption(option =>
      option.setName('field2_inline')
        .setDescription('Field 2 inline?')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('field3_name')
        .setDescription('Field 3 name')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('field3_value')
        .setDescription('Field 3 value')
        .setRequired(false)
        .setMaxLength(1024))
    .addBooleanOption(option =>
      option.setName('field3_inline')
        .setDescription('Field 3 inline?')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('field4_name')
        .setDescription('Field 4 name')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(option =>
      option.setName('field4_value')
        .setDescription('Field 4 value')
        .setRequired(false)
        .setMaxLength(1024))
    .addBooleanOption(option =>
      option.setName('field4_inline')
        .setDescription('Field 4 inline?')
        .setRequired(false))
    // ⭐ TARGET CHANNEL (REQUIRED) - 1 opción (Total: 24 opciones ✅)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('📌 Channel where the embed will be sent')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia)),

  async execute(interaction) {
    try {
      await InteractionHelper.safeDefer(interaction, { ephemeral: true });

      // Check staff permissions
      const member = interaction.member;
      const hasStaffRole = STAFF_ROLES.some(roleId => member.roles.cache.has(roleId));
      
      if (!hasStaffRole) {
        return InteractionHelper.safeReply(interaction, {
          content: '❌ You do not have permission to use this command. Staff roles only.',
          ephemeral: true
        });
      }

      // Get all options
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
        return InteractionHelper.safeReply(interaction, {
          content: '❌ Specified channel not found.',
          ephemeral: true
        });
      }

      // Check bot permissions
      const botMember = await targetChannel.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
        return InteractionHelper.safeReply(interaction, {
          content: `❌ I don't have permission to send messages in <#${targetChannel.id}>.`,
          ephemeral: true
        });
      }

      // Build embed
      const embed = new EmbedBuilder();
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      
      // Color
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
          embed.setColor('#5865F2');
        }
      } else {
        embed.setColor('#5865F2');
      }

      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
      if (footer) embed.setFooter({ text: footer, iconURL: footerIcon || null });
      if (author) embed.setAuthor({ name: author, iconURL: authorIcon || null });
      if (url) embed.setURL(url);

      // Fields (up to 4)
      const fields = [];
      for (let i = 1; i <= 4; i++) {
        const name = interaction.options.getString(`field${i}_name`);
        const value = interaction.options.getString(`field${i}_value`);
        const inline = interaction.options.getBoolean(`field${i}_inline`) || false;
        if (name && value) fields.push({ name, value, inline });
      }
      if (fields.length > 0) embed.addFields(fields);

      embed.setTimestamp();

      // Send
      await targetChannel.send({ embeds: [embed] });
      await InteractionHelper.safeReply(interaction, {
        content: `✅ Embed successfully sent to <#${targetChannel.id}>`,
        ephemeral: true
      });

      logger.info(`[EmbedCreate] User ${interaction.user.tag} sent embed to channel ${targetChannel.id}`);

    } catch (error) {
      logger.error(`[EmbedCreate] Error: ${error.message}`);
      await InteractionHelper.safeReply(interaction, {
        content: `❌ Error creating embed: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
