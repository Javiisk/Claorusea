// src/utils/applyHandlers.js
import { MessageFlags } from 'discord.js';
import {
  QUESTION_PAGES,
  TOTAL_PAGES,
  buildApplicationModal,
  buildDeclineModal,
  buildApplicationContainer,
} from './applyForm.js';
import { createApplicationRecord, getApplicationRecord, updateApplicationRecord } from './applyStorage.js';

const APPLICATION_LOG_CHANNEL_ID = process.env.APPLICATION_LOG_CHANNEL_ID || '1547414272231997522';

// Holds answers between the 4 chained modal submissions, per user.
// In-memory only — if the bot restarts mid-application the user has to
// start over with /apply again.
const pendingAnswers = new Map();

// ─── /apply command entry point ─────────────────────────────────────────

export async function startApplication(interaction) {
  pendingAnswers.set(interaction.user.id, {});
  await interaction.showModal(buildApplicationModal(0));
}

// ─── MODAL DISPATCH ──────────────────────────────────────────────────────

export async function handleApplyModal(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('apply_modal_')) {
    const pageIndex = parseInt(customId.replace('apply_modal_', ''), 10);
    return handlePageSubmit(interaction, pageIndex);
  }

  if (customId === 'apply_decline_modal') {
    return handleDeclineSubmit(interaction);
  }
}

async function handlePageSubmit(interaction, pageIndex) {
  const answers = pendingAnswers.get(interaction.user.id) || {};

  for (const question of QUESTION_PAGES[pageIndex]) {
    answers[question.key] = interaction.fields.getTextInputValue(question.key);
  }
  pendingAnswers.set(interaction.user.id, answers);

  const isLastPage = pageIndex === TOTAL_PAGES - 1;

  if (!isLastPage) {
    // Chain straight into the next modal.
    return interaction.showModal(buildApplicationModal(pageIndex + 1));
  }

  // ─── FINAL PAGE: log the application ──────────────────────────────
  await interaction.deferReply({ ephemeral: true });
  pendingAnswers.delete(interaction.user.id);

  const record = {
    applicantId: interaction.user.id,
    answers,
    status: 'pending',
    processedById: null,
    reason: null,
    createdAt: Date.now(),
  };

  const logChannel = await interaction.client.channels.fetch(APPLICATION_LOG_CHANNEL_ID).catch(() => null);

  if (!logChannel) {
    return interaction.editReply({
      content: '❌ Could not find the application log channel. Contact staff.',
    });
  }

  // Container references the message it lives in for the status field, so
  // send once with status "pending", get the message ID, then store it.
  const tempContainer = buildApplicationContainer(record);
  const logMessage = await logChannel.send({
    components: [tempContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  createApplicationRecord(logMessage.id, record);

  await interaction.editReply({
    content: 'You application has been logged, wait for your feedback.',
  });
}

// ─── BUTTON DISPATCH (accept / decline) ─────────────────────────────────

export async function handleApplyButton(interaction) {
  const { customId } = interaction;

  if (customId === 'apply_accept') {
    return handleAccept(interaction);
  }

  if (customId === 'apply_decline') {
    return interaction.showModal(buildDeclineModal());
  }
}

async function handleAccept(interaction) {
  const record = getApplicationRecord(interaction.message.id);

  if (!record || record.status !== 'pending') {
    return interaction.reply({ content: '❌ This application was already processed.', ephemeral: true });
  }

  const updated = updateApplicationRecord(interaction.message.id, {
    status: 'accepted',
    processedById: interaction.user.id,
  });

  const updatedContainer = buildApplicationContainer(updated);

  await interaction.update({
    components: [updatedContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function handleDeclineSubmit(interaction) {
  const record = getApplicationRecord(interaction.message.id);

  if (!record || record.status !== 'pending') {
    return interaction.reply({ content: '❌ This application was already processed.', ephemeral: true });
  }

  const reason = interaction.fields.getTextInputValue('decline_reason');

  const updated = updateApplicationRecord(interaction.message.id, {
    status: 'declined',
    processedById: interaction.user.id,
    reason,
  });

  const updatedContainer = buildApplicationContainer(updated);

  await interaction.update({
    components: [updatedContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
