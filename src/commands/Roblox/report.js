import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const REPORT_CHANNEL_ID = '1519529901906989229';

export default {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a player to staff.')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox username of the player').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the report').setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('evidence').setDescription('Screenshot or video as evidence (optional)').setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Report interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'report',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const reason = interaction.options.getString('reason');
      const evidence = interaction.options.getAttachment('evidence');

      // Send report to staff channel
      const reportChannel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID);
      if (!reportChannel) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not find the report channel. Please contact a staff member directly.',
        });
      }

      const reportEmbed = createEmbed({ title: '🚨 New Player Report', description: null })
        .setColor(0xed4245)
        .addFields(
          { name: '👤 Reported User', value: `\`${username}\``, inline: true },
          { name: '📋 Reported By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '🖼️ Evidence', value: evidence ? '[Attached below]' : 'No evidence provided.', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Reporter ID: ${interaction.user.id}` });

      // If evidence is an image, set it as the embed image
      if (evidence && evidence.contentType?.startsWith('image/')) {
        reportEmbed.setImage(evidence.url);
      }

      const messagePayload = { embeds: [reportEmbed] };

      // If evidence is a video or non-image file, send as a separate message
      if (evidence && !evidence.contentType?.startsWith('image/')) {
        messagePayload.content = `📎 **Evidence (video/file):** ${evidence.url}`;
      }

      await reportChannel.send(messagePayload);

      // Confirm to the user
      const confirmEmbed = createEmbed({ title: '✅ Report Submitted', description: null })
        .setDescription(`Your report against **${username}** has been submitted to staff. Thank you for helping keep the community safe!`)
        .setColor(0x57f287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });
    } catch (error) {
      logger.error('Report command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while submitting your report.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
