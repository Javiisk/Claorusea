import { logger } from '../../utils/logger.js';

const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

/**
 * Get Roblox user data from Discord ID using Bloxlink API
 */
export async function getRobloxUserByDiscord(discordId) {
  try {
    const url = `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': BLOXLINK_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!res.ok) {
      logger.warn(`[Bloxlink] API returned ${res.status} for user ${discordId}`);
      return null;
    }
    
    const data = await res.json();
    if (!data || !data.robloxID) {
      logger.warn(`[Bloxlink] No robloxID found for user ${discordId}`);
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error(`[Bloxlink] Error: ${error.message}`);
    return null;
  }
}

/**
 * Get Roblox username from user ID using Roblox API
 */
export async function getRobloxUsernameById(userId) {
  try {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(id)) {
      logger.warn(`[Bloxlink] Invalid userId: ${userId}`);
      return null;
    }
    
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    if (!res.ok) {
      logger.warn(`[Bloxlink] Roblox API returned ${res.status} for user ${id}`);
      return null;
    }
    
    const data = await res.json();
    return data.name || null;
  } catch (error) {
    logger.error(`[Bloxlink] Error getting username: ${error.message}`);
    return null;
  }
}

/**
 * Get Roblox user by username (legacy, for commands not yet migrated to Bloxlink)
 */
export async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    
    if (!res.ok) {
      logger.warn(`[Bloxlink] Roblox API returned ${res.status} for username ${username}`);
      return null;
    }
    
    const data = await res.json();
    return data.data?.[0] || null;
  } catch (error) {
    logger.error(`[Bloxlink] Error getting Roblox user: ${error.message}`);
    return null;
  }
}

/**
 * Get Roblox avatar URL from user ID
 */
export async function getRobloxAvatar(userId) {
  try {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(id)) return null;
    
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

/**
 * Get Roblox group rank from user ID
 */
export async function getRobloxGroupRank(userId) {
  try {
    const groupId = process.env.ROBLOX_GROUP_ID;
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(id)) return 'Error fetching rank';
    
    const res = await fetch(`https://groups.roblox.com/v2/users/${id}/groups/roles`);
    if (!res.ok) return 'Error fetching rank';
    
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(groupId));
    return group ? group.role.name : 'Not in the group';
  } catch {
    return 'Error fetching rank';
  }
}

/**
 * Check if user is in blacklisted groups
 */
export async function checkBlacklistedGroups(userId, blacklistedGroups) {
  try {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(id)) return null;
    
    const res = await fetch(`https://groups.roblox.com/v2/users/${id}/groups/roles`);
    if (!res.ok) return null;
    
    const data = await res.json();
    const userGroups = data.data?.map(g => String(g.group.id)) || [];
    const found = blacklistedGroups.find(g => userGroups.includes(g.id));
    return found || null;
  } catch {
    return null;
  }
}

/**
 * Get Roblox user ID by Discord ID (alias for getRobloxUserByDiscord)
 */
export async function getRobloxIdByDiscord(discordId) {
  const data = await getRobloxUserByDiscord(discordId);
  return data ? data.robloxID : null;
}

/**
 * Get Roblox username by Discord ID (combines both functions)
 */
export async function getRobloxUsernameByDiscord(discordId) {
  const data = await getRobloxUserByDiscord(discordId);
  if (!data || !data.robloxID) return null;
  
  const username = await getRobloxUsernameById(data.robloxID);
  return username || data.primaryAccount || null;
}

/**
 * Get complete Roblox user info by Discord ID
 */
export async function getRobloxUserInfoByDiscord(discordId) {
  const data = await getRobloxUserByDiscord(discordId);
  if (!data || !data.robloxID) return null;
  
  const userId = data.robloxID;
  const username = await getRobloxUsernameById(userId);
  
  return {
    id: userId,
    username: username || data.primaryAccount || 'Unknown',
    primaryAccount: data.primaryAccount || null,
    avatar: await getRobloxAvatar(userId),
    rank: await getRobloxGroupRank(userId),
  };
      }
