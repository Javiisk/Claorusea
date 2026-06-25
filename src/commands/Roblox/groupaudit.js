import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = '376034335';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function getAuditLog() {
  const res = await fetch(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/audit-log?actionType=all&limit=25`,
    { headers: { 'x-api-key': process.env.ROBLOX_API_KEY } }
  );
  if (!res.ok) throw new Error(`Audit log API error: ${res.status}`);
  const data = await res.json();
  return data.data ?? [];
}

const ACTION_LABELS = {
  changeRank: '🎖️ Rank Change',
  kick: '👢 Kick',
  ban: '🔨 Ban',
  unban: '✅ Unban',
  postShout: '📢 Shout',
  changeDescription: '📝 Description Changed',
  inviteToClan: '📨 Invite',
  changeOwner: '👑 Owner Changed',
  deletePost: '🗑️ Post Deleted',
  acceptJoinRequest: '✅ Join Accepted',
  declineJoinRequest: '❌ Join Declined',
};

export default {
  data: new SlashCommandBuilder()
    .setName('groupaudit')
    .setDescription('View the latest group audit log actions. (Staff only)')
    .setDMPermission(false),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Groupaudit interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'groupaudit' });
      return;
    }

    try {
      const logs = await getAuditLog();

      if (logs.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, { content: '📭 No audit log entries found.' });
      }

      const embed = createEmbed({ title: '📋 Group Audit Log', description: null })
        .setColor(0x5865f2)
        .setFooter({ text: `Group ID: ${GROUP_ID} • Last 25 actions` })
        .setTimestamp();

      for (const entry of logs.slice(0, 15)) {
        const action = ACTION_LABELS[entry.actionType] ?? `🔹 ${entry.actionType}`;
        const actor = entry.actor?.user?.username ?? 'Unknown';
        const target = entry.description?.TargetName ?? entry.description?.NewRoleName ?? '';
        const ts = entry.created
          ? `<t:${Math.floor(new Date(entry.created).getTime() / 1000)}:R>`
          : 'Unknown';

        let value = `👤 **Actor:** \`${actor}\`\n🕐 ${ts}`;
        if (target) value += `\n🎯 **Target:** \`${target}\``;
        if (entry.description?.OldRoleName && entry.description?.NewRoleName) {
          value += `\n📉 ${entry.description.OldRoleName} → ${entry.description.NewRoleName}`;
        }

        embed.addFields({ name: action, value, inline: false });
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Groupaudit command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred while fetching the audit log.' });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
