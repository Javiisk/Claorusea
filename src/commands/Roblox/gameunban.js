import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function unbanUser(userId) {
  try {
    const url = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/user-restrictions/${userId}`;
    
    const body = {
      gameJoinRestriction: {
        active: false,
      }
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    logger.error('[GameUnban] Error unbanning user:', error);
    return { success: false, error: error.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('gameunban')
    .setDescription('🔓 Unban a user from the game (Staff only)')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to unban')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user');

      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const result = await unbanUser(robloxId);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to unban **${robloxUsername}**: ${result.error}`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Game Unban')
        .setDescription(`✅ Successfully unbanned **${robloxUsername}** from the game!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '👤 Unbanned by', value: `${interaction.user}`, inline: true }
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      logger.info(`[GameUnban] ${interaction.user.tag} unbanned ${robloxUsername}`);

    } catch (error) {
      logger.error('GameUnban error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};