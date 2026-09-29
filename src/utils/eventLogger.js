// src/utils/eventLogger.js
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';

const LOG_CHANNEL_ID = process.env.EVENT_LOG_CHANNEL_ID || '1547414356210225203';

// guildId -> Map(inviteCode -> uses)
const inviteCache = new Map();

function truncate(text, max = 900) {
  if (!text) return '*(empty)*';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function sendLog(client, title, lines) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error(`❌ Could not find/access the event log channel ${LOG_CHANNEL_ID}.`);
    return;
  }

  const container = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));

  await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch((error) => {
    console.error('❌ Failed to send event log:', error);
  });
}

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
  } catch (error) {
    console.error(`❌ Could not cache invites for ${guild.name}:`, error.message);
  }
}

export function attachEventLogging(client) {
  // ─── Cache invites on startup, for every guild the bot is in ─────────
  client.once('ready', () => {
    client.guilds.cache.forEach(guild => cacheGuildInvites(guild));
  });

  // ─── MESSAGE DELETED ────────────────────────────────────────────────
  client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;

    await sendLog(client, '🗑️ Message Deleted', [
      `**Author**\n${message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unknown (uncached message)'}`,
      `**Channel**\n<#${message.channelId}>`,
      `**Content**\n${truncate(message.content)}`,
    ]);
  });

  // ─── BULK MESSAGE DELETE ────────────────────────────────────────────
  client.on('messageDeleteBulk', async (messages) => {
    const channel = messages.first()?.channel;

    await sendLog(client, '🧹 Bulk Message Delete', [
      `**Channel**\n${channel ? `<#${channel.id}>` : 'Unknown'}`,
      `**Amount**\n${messages.size} message(s)`,
    ]);
  });

  // ─── MESSAGE EDITED ─────────────────────────────────────────────────
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    await sendLog(client, '✏️ Message Edited', [
      `**Author**\n<@${newMessage.author.id}> (${newMessage.author.tag})`,
      `**Channel**\n<#${newMessage.channelId}>`,
      `**Before**\n${truncate(oldMessage.content || '*(not cached)*')}`,
      `**After**\n${truncate(newMessage.content)}`,
    ]);
  });

  // ─── INVITE CREATED ─────────────────────────────────────────────────
  client.on('inviteCreate', async (invite) => {
    const cache = inviteCache.get(invite.guild.id) || new Map();
    cache.set(invite.code, invite.uses || 0);
    inviteCache.set(invite.guild.id, cache);

    await sendLog(client, '🔗 Invite Created', [
      `**Code**\n${invite.code}`,
      `**Created by**\n${invite.inviter ? `<@${invite.inviter.id}> (${invite.inviter.tag})` : 'Unknown'}`,
      `**Channel**\n<#${invite.channelId}>`,
      `**Max Uses**\n${invite.maxUses || 'Unlimited'}`,
      `**Expires**\n${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:F>` : 'Never'}`,
    ]);
  });

  // ─── INVITE DELETED ─────────────────────────────────────────────────
  client.on('inviteDelete', async (invite) => {
    const cache = inviteCache.get(invite.guild.id);
    cache?.delete(invite.code);

    await sendLog(client, '🔗 Invite Deleted', [
      `**Code**\n${invite.code}`,
      `**Channel**\n<#${invite.channelId}>`,
    ]);
  });

  // ─── MEMBER JOINED — which invite did they use? ──────────────────────
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const oldCache = inviteCache.get(guild.id) || new Map();

    const newInvites = await guild.invites.fetch().catch(() => null);
    if (!newInvites) return;

    const usedInvite = newInvites.find(inv => (oldCache.get(inv.code) || 0) < inv.uses);

    inviteCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

    await sendLog(client, '📥 Member Joined', [
      `**User**\n<@${member.id}> (${member.user.tag})`,
      `**Invite Used**\n${usedInvite ? `\`${usedInvite.code}\` (${usedInvite.uses} uses)` : 'Unknown (vanity URL, or invite expired)'}`,
      `**Invited by**\n${usedInvite?.inviter ? `<@${usedInvite.inviter.id}> (${usedInvite.inviter.tag})` : 'Unknown'}`,
      `**Account Created**\n<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
    ]);
  });

  // ─── MEMBER LEFT ────────────────────────────────────────────────────
  client.on('guildMemberRemove', async (member) => {
    await sendLog(client, '📤 Member Left', [
      `**User**\n<@${member.id}> (${member.user.tag})`,
    ]);
  });

  console.log('✅ Event logging attached.');
}
