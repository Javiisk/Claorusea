// src/utils/applyHandlers.js
import { MessageFlags } from 'discord.js';
import {
  QUESTIONS,
  buildQuestionContainer,
  buildQuestionModal,
  buildDoneContainer,
  buildDeclineModal,
  buildApplicationContainer,
} from './applyForm.js';
import { createApplicationRecord, getApplicationRecord, updateApplicationRecord } from './applyStorage.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const APPLICATION_LOG_CHANNEL_ID = process.env.APPLICATION_LOG_CHANNEL_ID || '1547414272231997522';

// Holds application-in-progress state, keyed by the DM message ID that
// carries the current question. In-memory only — if the bot restarts
// mid-application the user has to start over with /apply.
const pendingApplications = new Map();

// ─── /apply command entry point ─────────────────────────────────────────

export async function startApplication(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const robloxInfo = await getRobloxUserInfoByDiscord(interaction.user.id);

  if (!robloxInfo) {
    return interaction.editReply({
      content: '❌ You do not have a Roblox account linked in this server.',
    });
  }

  let dmMessage;
  try {
    const dmChannel = await interaction.user.createDM();
    dmMessage = await dmChannel.send({
      components: [buildQuestionContainer(0)],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch {
    return interaction.editReply({
      content: '❌ Could not send you a DM. Please enable your DMs and try again.',
    });
  }

  pendingApplications.set(dmMessage.id, {
    applicantId: interaction.user.id,
    discordUsername: interaction.user.tag,
    accountCreatedAt: interaction.user.createdTimestamp,
    robloxUsername: robloxInfo.username,
    answers: {},
  });

  await interaction.editReply({ content: '✅ Check your DMs to fill out the application!' });
}

// ─── BUTTON DISPATCH ─────────────────────────────────────────────────────

export async function handleApplyButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('apply_answer_')) {
    const index = parseInt(customId.replace('apply_answer_', ''), 10);
    return interaction.showModal(buildQuestionModal(index));
  }

  if (customId === 'apply_accept') {
    return handleAccept(interaction);
  }

  if (customId === 'apply_decline') {
    return interaction.showModal(buildDeclineModal());
  }
}

// ─── MODAL DISPATCH ──────────────────────────────────────────────────────

export async function handleApplyModal(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('apply_qmodal_')) {
    const index = parseInt(customId.replace('apply_qmodal_', ''), 10);
    return handleQuestionSubmit(interaction, index);
  }

  if (customId === 'apply_decline_modal') {
    return handleDeclineSubmit(interaction);
  }
}

async function handleQuestionSubmit(interaction, index) {
  const state = pendingApplications.get(interaction.message.id);

  if (!state) {
    return interaction.reply({ content: '❌ This application session expired. Run /apply again.', ephemeral: true });
  }

  state.answers[QUESTIONS[index].key] = interaction.fields.getTextInputValue('answer');

  const nextIndex = index + 1;

  if (nextIndex < QUESTIONS.length) {
    await interaction.update({
      components: [buildQuestionContainer(nextIndex)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // ─── LAST QUESTION: finalize ───────────────────────────────────────
  await interaction.update({
    components: [buildDoneContainer()],
    flags: MessageFlags.IsComponentsV2,
  });

  pendingApplications.delete(interaction.message.id);

  const record = {
    applicantId: state.applicantId,
    discordUsername: state.discordUsername,
    accountCreatedAt: state.accountCreatedAt,
    robloxUsername: state.robloxUsername,
    answers: state.answers,
    status: 'pending',
    processedById: null,
    reason: null,
    createdAt: Date.now(),
  };

  const logChannel = await interaction.client.channels.fetch(APPLICATION_LOG_CHANNEL_ID).catch(() => null);

  if (logChannel) {
    const logContainer = buildApplicationContainer(record);
    const logMessage = await logChannel.send({
      components: [logContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    createApplicationRecord(logMessage.id, record);
  }
}

// ─── ACCEPT / DECLINE (in the log channel) ──────────────────────────────

async function handleAccept(interaction) {
  const record = getApplicationRecord(interaction.message.id);

  if (!record || record.status !== 'pending') {
    return interaction.reply({ content: '❌ This application was already processed.', ephemeral: true });
  }

  const updated = updateApplicationRecord(interaction.message.id, {
    status: 'accepted',
    processedById: interaction.user.id,
  });

  await interaction.update({
    components: [buildApplicationContainer(updated)],
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

  await interaction.update({
    components: [buildApplicationContainer(updated)],
    flags: MessageFlags.IsComponentsV2,
  });
}
