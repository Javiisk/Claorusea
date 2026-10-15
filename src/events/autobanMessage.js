// src/events/autobanMessage.js
import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { sendBanDM } from '../utils/banNotifier.js';

const AUTOBAN_CHANNEL_ID = '1560388916018683965';
const BAN_LOG_CHANNEL_ID = '1547414356210225203';

export function registerAutoban(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channel.id !== AUTOBAN_CHANNEL_ID) return;

    const member = message.member;
    if (!member) return;

    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      logger.warn('[AutoBan] Bot lacks BanMembers permission');
      return;
    }

    if (!member.bannable) {
      logger.warn(`[AutoBan] Cannot ban ${member.user.tag} (higher role or missing perms)`);
      return;
    }

    try {
      // Delete the message
      await message.delete().catch(() => {});

      // Send DM BEFORE banning
      await sendBanDM(member.user).catch((e) => logger.warn('[AutoBan] DM failed:', e.message));

      // Ban for 7 days (temporary)
      await message.guild.members.ban(member.id, {
        reason: 'Talking in autoban channel',
        deleteMessageSeconds: 604800,
      });

      logger.info(`[AutoBan] Banned ${member.user.tag} for talking in autoban channel`);

      // Log to ban log channel
      const logChannel = await client.channels.fetch(BAN_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send(
          `🔨 **${member.user.tag}** (\`${member.id}\`) was banned for talking in <#${AUTOBAN_CHANNEL_ID}>`
        ).catch(() => {});
      }
    } catch (err) {
      logger.error('[AutoBan] Ban failed:', err.message);
    }
  });
}