// src/utils/bugForum.js
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';
import { createFeedbackRequest } from './bugFeedbackStorage.js';

export const BUG_FORUM_CHANNEL_ID = process.env.BUG_FORUM_CHANNEL_ID || '1547000152244486175';
export const RESOLVE_ROLE_IDS = [
  process.env.RESOLVE_ROLE_1 || '1547335308276793484',
  process.env.RESOLVE_ROLE_2 || '1547335475390583036',
  process.env.RESOLVE_ROLE_3 || '1547335161081888808',
];

// ─── NEW FORUM POST → intro message ─────────────────────────────────────

export async function handleForumThreadCreate(thread) {
  if (thread.parentId !== BUG_FORUM_CHANNEL_ID) return;

  const container = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Greetings <@${thread.ownerId}>, Thank you for opening a bug report, Remember to follow the format found in the pinned forum and ensure it's not a bug that has already been reported!`,
      ),
    )
    .addSeparatorComponents(separator => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# A high-ranking official will contact you here.'),
    );

  await thread.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

// ─── RESOLVE (shared by /resolved and the "Mark Resolved" context menu) ──

export function hasResolveRole(interaction) {
  return RESOLVE_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
}

export async function handleResolveThread(interaction) {
  const thread = interaction.channel;

  if (!thread.isThread() || thread.parentId !== BUG_FORUM_CHANNEL_ID) {
    return interaction.reply({
      content: '❌ This can only be used inside a bug report thread.',
      ephemeral: true,
    });
  }

  if (!hasResolveRole(interaction)) {
    return interaction.reply({ content: '❌ You cannot use this.', ephemeral: true });
  }

  if (thread.name.startsWith('[RESOLVED]')) {
    return interaction.reply({ content: '❌ This bug report is already marked as resolved.', ephemeral: true });
  }

  await interaction.deferReply();

  const originalTitle = thread.name;
  const newName = `[RESOLVED] ${originalTitle}`.slice(0, 100);

  await thread.setName(newName).catch(() => {});

  const resolvedContainer = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'This bug has been resolved and will be fixed in the next update or bug fixes! I hope this has helped you, and I hope you can give us feedback via you DMs.',
      ),
    )
    .addSeparatorComponents(separator => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# This forum has been locked.'),
    );

  await thread.send({ components: [resolvedContainer], flags: MessageFlags.IsComponentsV2 });

  await thread.setLocked(true).catch(() => {});

  await interaction.editReply({ content: `✅ Marked **${originalTitle}** as resolved.` });

  // ─── DM the thread owner for feedback ──────────────────────────────
  await sendFeedbackRequest({
    client: interaction.client,
    threadId: thread.id,
    threadTitle: originalTitle,
    ownerId: thread.ownerId,
    resolverId: interaction.user.id,
  });
}

async function sendFeedbackRequest({ client, threadId, threadTitle, ownerId, resolverId }) {
  try {
    const owner = await client.users.fetch(ownerId);
    if (owner.bot) return;

    const { buildFeedbackRequestContainer } = await import('./bugFeedback.js');
    const container = buildFeedbackRequestContainer(resolverId, threadTitle);

    const dm = await owner.send({ components: [container], flags: MessageFlags.IsComponentsV2 });

    createFeedbackRequest(dm.id, { threadId, threadTitle, ownerId, resolverId });
  } catch {
    // DMs disabled — nothing we can do.
  }
}
