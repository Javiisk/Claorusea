// src/utils/bugFeedback.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { getFeedbackRequest, deleteFeedbackRequest } from './bugFeedbackStorage.js';

const FEEDBACK_LOG_CHANNEL_ID = process.env.BUG_FEEDBACK_LOG_CHANNEL_ID || '1553304567230365736';

export function buildFeedbackRequestContainer(resolverId, threadTitle) {
  const stars = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map(n =>
      new ButtonBuilder()
        .setCustomId(`bugfeedback_star_${n}`)
        .setLabel(String(n))
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### ⭐ Rate Your Experience'),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `How would you rate the help you received from <@${resolverId}> regarding **${threadTitle}**?`,
      ),
    )
    .addActionRowComponents(stars);
}

export async function handleStarButton(interaction) {
  const record = getFeedbackRequest(interaction.message.id);

  if (!record) {
    return interaction.reply({ content: '❌ This feedback request is no longer available.', ephemeral: true });
  }

  if (interaction.user.id !== record.ownerId) {
    return interaction.reply({ content: '❌ You cannot use this button.', ephemeral: true });
  }

  const stars = parseInt(interaction.customId.replace('bugfeedback_star_', ''), 10);

  const modal = new ModalBuilder()
    .setCustomId(`bugfeedback_modal_${stars}`)
    .setTitle('Give Feedback')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Did you feel comfortable? Any comments?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );

  await interaction.showModal(modal);
}

export async function handleFeedbackModal(interaction) {
  const record = getFeedbackRequest(interaction.message.id);

  if (!record) {
    return interaction.reply({ content: '❌ This feedback request is no longer available.', ephemeral: true });
  }

  const stars = parseInt(interaction.customId.replace('bugfeedback_modal_', ''), 10);
  const reason = interaction.fields.getTextInputValue('reason') || 'No comment provided.';

  const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);

  const logChannel = await interaction.client.channels.fetch(FEEDBACK_LOG_CHANNEL_ID).catch(() => null);

  if (logChannel) {
    const logContainer = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### 📋 Bug Resolution Feedback'),
      )
      .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**Bug**\n${record.threadTitle}`,
            '',
            `**Resolved by**\n<@${record.resolverId}>`,
            '',
            `**Feedback from**\n<@${record.ownerId}>`,
            '',
            `**Rating**\n${starDisplay} (${stars}/5)`,
            '',
            `**Reason**\n${reason}`,
          ].join('\n'),
        ),
      );

    await logChannel.send({ components: [logContainer], flags: MessageFlags.IsComponentsV2 });
  }

  deleteFeedbackRequest(interaction.message.id);

  const thanksContainer = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('✅ Thanks for your feedback!'),
    );

  await interaction.update({ components: [thanksContainer], flags: MessageFlags.IsComponentsV2 });
}
