// src/commands/utility/say.js
import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  AttachmentBuilder
} from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot send a message with optional attachments.')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
        .setMaxLength(2000))
    
    // ─── ATTACHMENTS ─────────────────────────────────────────────────────
    .addAttachmentOption(opt =>
      opt.setName('image')
        .setDescription('Image to attach (jpg, png, gif, webp)')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('image2')
        .setDescription('Second image to attach')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('image3')
        .setDescription('Third image to attach')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('Any file to attach')
        .setRequired(false))
    
    // ─── EMBED ───────────────────────────────────────────────────────────
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Optional title (turns message into an embed)')
        .setRequired(false)
        .setMaxLength(256))
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Embed color')
        .setRequired(false)
        .addChoices(
          { name: '🔵 Blue', value: '#5865F2' },
          { name: '🟢 Green', value: '#57F287' },
          { name: '🔴 Red', value: '#ED4245' },
          { name: '🟡 Yellow', value: '#FEE75C' },
          { name: '🟣 Purple', value: '#9B59B6' },
          { name: '⚫ Black', value: '#000000' },
          { name: '⚪ White', value: '#FFFFFF' },
        ))
    .addStringOption(opt =>
      opt.setName('footer')
        .setDescription('Optional footer text')
        .setRequired(false)
        .setMaxLength(2048))
    
    // ─── SPECIAL MODES ───────────────────────────────────────────────────
    .addStringOption(opt =>
      opt.setName('reply_to')
        .setDescription('Message ID to reply to (optional)')
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName('anonymous')
        .setDescription('Remove the "sent by" attribution')
        .setRequired(false))
    .addBooleanOption(opt =>
      opt.setName('tts')
        .setDescription('Send as text-to-speech')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message');
    const title = interaction.options.getString('title');
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const replyTo = interaction.options.getString('reply_to');
    const anonymous = interaction.options.getBoolean('anonymous') || false;
    const tts = interaction.options.getBoolean('tts') || false;

    // Collect attachments
    const attachments = [
      interaction.options.getAttachment('image'),
      interaction.options.getAttachment('image2'),
      interaction.options.getAttachment('image3'),
      interaction.options.getAttachment('file'),
    ].filter(Boolean);

    try {
      // ─── REPLY MODE ──────────────────────────────────────────────────
      if (replyTo) {
        const targetMessage = await interaction.channel.messages.fetch(replyTo).catch(() => null);
        
        if (!targetMessage) {
          return interaction.editReply({
            content: `❌ Message with ID \`${replyTo}\` was not found in this channel.`
          });
        }

        // If there's a title, send embed. Otherwise plain text.
        let payload;
        if (title) {
          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(color || '#5865F2');
          
          if (footer) embed.setFooter({ text: footer });
          if (attachments.length > 0) {
            embed.setImage(attachments[0].url);
            for (let i = 1; i < attachments.length; i++) {
              embed.addFields({ name: '\u200b', value: `[Attachment ${i + 1}](${attachments[i].url})` });
            }
          }

          payload = { embeds: [embed] };
        } else {
          payload = { content: message, tts };
          if (attachments.length > 0) {
            payload.files = attachments.map(a => a.url);
          }
        }

        await targetMessage.reply(payload);

      // ─── NORMAL MODE ─────────────────────────────────────────────────
      } else {
        let payload;

        if (title) {
          // EMBED MODE
          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(color || '#5865F2');

          if (footer) embed.setFooter({ text: footer });
          
          if (attachments.length > 0) {
            embed.setImage(attachments[0].url);
            for (let i = 1; i < attachments.length; i++) {
              embed.addFields({ 
                name: `📎 Attachment ${i + 1}`, 
                value: `[View file](${attachments[i].url})`,
                inline: false
              });
            }
          }

          if (!anonymous) {
            embed.setTimestamp();
          }

          payload = { embeds: [embed] };
        } else {
          // PLAIN TEXT MODE
          payload = { content: message, tts };
          
          if (attachments.length > 0) {
            payload.files = attachments.map(a => a.url);
          }
        }

        await interaction.channel.send(payload);
      }

      // ─── CONFIRMATION ────────────────────────────────────────────────
      const confirmEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Message Sent')
        .addFields(
          { name: '📝 Content', value: message.slice(0, 1024), inline: false },
          { name: '📎 Attachments', value: `${attachments.length} file(s)`, inline: true },
          { name: '📍 Channel', value: `<#${interaction.channel.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed] });

      logger.info(`[Say] ${interaction.user.tag} in #${interaction.channel.name}: ${message.slice(0, 50)}...`);

    } catch (error) {
      logger.error('Say command error:', error.message, error.stack);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`
      });
    }
  },
};