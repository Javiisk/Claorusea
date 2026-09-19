// src/utils/ticketHandlers.js
import {
  ChannelType,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';
import { TICKET_CATEGORIES, buildCategoryModal, buildCloseModal, buildTicketContainer } from './ticketPanel.js';
import { createTicketRecord, getTicketRecord, updateTicketRecord, deleteTicketRecord } from './ticketStorage.js';

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1546992415972266044';
const TRANSCRIPT_CHANNEL_ID = process.env.TRANSCRIPT_CHANNEL_ID || '1547414643235102730';
const TICKET_PING_ROLE_ID = process.env.TICKET_PING_ROLE_ID || '1547026097164652594';

// ─── BUTTON DISPATCH ─────────────────────────────────────────────────────

export async function handleTicketButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('ticket_open_')) {
    const categoryKey = customId.replace('ticket_open_', '');
    if (!TICKET_CATEGORIES[categoryKey]) return;
    return interaction.showModal(buildCategoryModal(categoryKey));
  }

  if (customId === 'ticket_claim') {
    return handleClaim(interaction);
  }

  if (customId === 'ticket_close') {
    return interaction.showModal(buildCloseModal());
  }
}

// ─── MODAL DISPATCH ──────────────────────────────────────────────────────

export async function handleTicketModal(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('ticket_modal_')) {
    const categoryKey = customId.replace('ticket_modal_', '');
    return handleCategorySubmit(interaction, categoryKey);
  }

  if (customId === 'ticket_close_modal') {
    return handleCloseSubmit(interaction);
  }
}

// ─── OPEN TICKET (modal submitted) ──────────────────────────────────────

async function handleCategorySubmit(interaction, categoryKey) {
  await interaction.deferReply({ ephemeral: true });

  const category = TICKET_CATEGORIES[categoryKey];
  const answers = {};
  category.questions.forEach((question, index) => {
    answers[`q${index}`] = interaction.fields.getTextInputValue(`q${index}`);
  });

  const guild = interaction.guild;
  const categoryChannel = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);

  const safeUsername = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || interaction.user.id;
  const channelName = `${categoryKey}-${safeUsername}`;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  // Inherit staff role visibility from the ticket category itself.
  if (categoryChannel) {
    for (const overwrite of categoryChannel.permissionOverwrites.cache.values()) {
      overwrites.push({ id: overwrite.id, allow: overwrite.allow, deny: overwrite.deny });
    }
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryChannel?.id,
    permissionOverwrites: overwrites,
  });

  createTicketRecord(ticketChannel.id, {
    openerId: interaction.user.id,
    category: categoryKey,
    answers,
    claimedById: null,
    createdAt: Date.now(),
  });

  // Ping as its own message (plain text as a top-level component — NOT
  // `content`, since content can't be combined with Components V2).
  const pingText = new TextDisplayBuilder().setContent(
    `<@&${TICKET_PING_ROLE_ID}> <@${interaction.user.id}>`,
  );
  await ticketChannel.send({
    components: [pingText],
    flags: MessageFlags.IsComponentsV2,
  });

  const ticketContainer = buildTicketContainer({
    categoryKey,
    openerId: interaction.user.id,
    answers,
    claimedById: null,
  });

  await ticketChannel.send({
    components: [ticketContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  await interaction.editReply({
    content: `✅ Your ticket has been created: ${ticketChannel}`,
  });
}

// ─── CLAIM ───────────────────────────────────────────────────────────────

async function handleClaim(interaction) {
  const record = getTicketRecord(interaction.channel.id);

  if (!record) {
    return interaction.reply({ content: '❌ This ticket is no longer tracked.', ephemeral: true });
  }

  if (record.claimedById) {
    return interaction.reply({
      content: `❌ This ticket is already claimed by <@${record.claimedById}>.`,
      ephemeral: true,
    });
  }

  updateTicketRecord(interaction.channel.id, { claimedById: interaction.user.id });

  const updatedContainer = buildTicketContainer({
    categoryKey: record.category,
    openerId: record.openerId,
    answers: record.answers,
    claimedById: interaction.user.id,
  });

  await interaction.update({
    components: [updatedContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── CLOSE (modal submitted) ─────────────────────────────────────────────

async function handleCloseSubmit(interaction) {
  await interaction.deferReply();

  const record = getTicketRecord(interaction.channel.id);
  const reason = interaction.fields.getTextInputValue('close_reason');

  // ─── BUILD TRANSCRIPT ──────────────────────────────────────────────
  const messages = [];
  let lastId;

  // Paginate backwards through the channel's history (100 at a time),
  // capped at 1000 messages so a huge ticket doesn't hang forever.
  while (messages.length < 1000) {
    const batch = await interaction.channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!batch || batch.size === 0) break;
    messages.push(...batch.values());
    lastId = batch.last().id;
  }

  messages.reverse();

  const transcriptText = messages
    .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '*[no text content]*'}`)
    .join('\n');

  const transcriptBuffer = Buffer.from(transcriptText || 'No messages.', 'utf-8');
  const attachment = new AttachmentBuilder(transcriptBuffer, {
    name: `transcript-${interaction.channel.name}.txt`,
  });

  // ─── LOG TO TRANSCRIPT CHANNEL ───────────────────────────────────────

  const transcriptChannel = await interaction.client.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);

  if (transcriptChannel) {
    const category = record ? TICKET_CATEGORIES[record.category] : null;

    const logContainer = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### 🔒 Ticket Closed'),
      )
      .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**Category**\n${category?.label || record?.category || 'Unknown'}`,
            '',
            `**Opened by**\n${record ? `<@${record.openerId}>` : 'Unknown'}`,
            '',
            `**Claimed by**\n${record?.claimedById ? `<@${record.claimedById}>` : 'No one'}`,
            '',
            `**Closed by**\n<@${interaction.user.id}>`,
            '',
            `**Reason**\n${reason}`,
          ].join('\n'),
        ),
      );

    await transcriptChannel.send({
      components: [logContainer],
      flags: MessageFlags.IsComponentsV2,
      files: [attachment],
    });
  }

  // ─── DM THE OPENER ────────────────────────────────────────────────────

  if (record) {
    try {
      const opener = await interaction.client.users.fetch(record.openerId);
      const dmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### 🔒 Your ticket has been closed'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Reason**\n${reason}`),
        );

      await opener.send({
        components: [dmContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch { /* DMs disabled */ }
  }

  deleteTicketRecord(interaction.channel.id);

  await interaction.editReply({ content: '✅ Ticket closed. This channel will be deleted shortly.' });

  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}
