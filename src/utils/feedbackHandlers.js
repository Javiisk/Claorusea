// src/utils/feedbackHandlers.js
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';
import { getFeedbackRecord } from './feedbackStorage.js';

const FEEDBACK_ROLE_1 = process.env.FEEDBACK_ROLE_1 || '1547335308276793484';
const FEEDBACK_ROLE_2 = process.env.FEEDBACK_ROLE_2 || '1547335475390583036';

export async function handleFeedbackButton(interaction) {
  const record = getFeedbackRecord(interaction.message.id);

  if (!record) {
    return interaction.reply({ content: '❌ This feedback is no longer available.', ephemeral: true });
  }

  const isTargetUser = interaction.user.id === record.targetUserId;
  const hasStaffRole = interaction.member.roles.cache.has(FEEDBACK_ROLE_1)
    || interaction.member.roles.cache.has(FEEDBACK_ROLE_2);

  if (!isTargetUser && !hasStaffRole) {
    return interaction.reply({ content: '❌ You cannot use this button.', ephemeral: true });
  }

  const feedbackContainer = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 📋 Application Feedback'))
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(record.feedbackText));

  await interaction.reply({
    components: [feedbackContainer],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}
