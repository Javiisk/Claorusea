import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1530033235403210762';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    const data = await res.json();
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

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

async function sendLog(interaction, robloxUsername, robloxId, success) {
  try {
    const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(success ? 0x57F287 : 0xED4245)
      .setTitle(success ? '🔓 Game Unban' : '⚠️ Game Unban Failed')
      .setDescription(success
        ? `✅ Successfully unbanned **${robloxUsername}** from the game!`
        : `❌ Failed to unban **${robloxUsername}**`
      )
      .addFields(
        { name: '👤 Roblox User', value: robloxUsername, inline: true },
        { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
        { name: '👮 Unbanned by', value: `${interaction.user} (${interaction.user.tag})`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('[GameUnban] Log error:', error);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('gameunban')
    .setDescription('🔓 Unban a user from the game by Roblox username (Staff only)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('robloxuser')
        .setDescription('Roblox username to unban')
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
      const robloxUsername = interaction.options.getString('robloxuser');

      const roblox = await getRobloxUser(robloxUsername);
      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      const robloxId = roblox.id;
      const robloxName = roblox.name;

      const result = await unbanUser(robloxId);

      await sendLog(interaction, robloxName, robloxId, result.success);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to unban **${robloxName}**: ${result.error}`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Game Unban')
        .setDescription(`✅ Successfully unbanned **${robloxName}** from the game!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxName, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '👤 Unbanned by', value: `${interaction.user}`, inline: true }
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      logger.info(`[GameUnban] ${interaction.user.tag} unbanned ${robloxName}`);

    } catch (error) {
      logger.error('GameUnban error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};