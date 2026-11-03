// src/utils/rankSync.js
import { getRobloxGroupRank } from './bloxlink.js';
import { logger } from './logger.js';

export async function syncRoles(member, robloxId) {
  try {
    const robloxRankName = await getRobloxGroupRank(robloxId);
    
    if (!robloxRankName || robloxRankName === 'Error fetching rank' || robloxRankName === 'Not in the group') {
      return { success: false, reason: 'No rank in Roblox group.' };
    }

    const discordRole = member.guild.roles.cache.find(
      role => role.name.toLowerCase() === robloxRankName.toLowerCase()
    );

    if (!discordRole) {
      return { success: false, reason: `No Discord role found matching "${robloxRankName}".` };
    }

    if (!member.roles.cache.has(discordRole.id)) {
      await member.roles.add(discordRole);
      logger.info(`[RankSync] Gave role ${discordRole.name} to ${member.user.tag}`);
    }

    return { success: true, roleName: discordRole.name };
  } catch (error) {
    logger.error('[RankSync] Error:', error);
    return { success: false, reason: error.message };
  }
}