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

// ─── FUNCIÓN PARA BANEAR CON DETECCIÓN DE ALTS ──────────────────────────

async function banUserWithAlts(userId, durationSeconds, displayReason, privateReason) {
  try {
    // Verificar si el usuario ya está baneado
    const checkRes = await fetch(
      `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/user-restrictions/${userId}`,
      { headers: { 'x-api-key': ROBLOX_API_KEY } }
    );
    
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.gameJoinRestriction?.active) {
        return { success: false, error: 'User is already banned.', alreadyBanned: true };
      }
    }

    // Banear al usuario principal (y sus alts automáticamente)
    const url = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/user-restrictions/${userId}`;
    
    const body = {
      gameJoinRestriction: {
        active: true,
        duration: `${durationSeconds}s`,
        displayReason: displayReason || 'Banned by staff.',
        privateReason: privateReason || 'No reason provided.',
        excludeAltAccounts: false, // ← Esto banea automáticamente las alts
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
    logger.error('[GameBan] Error banning user:', error);
    return { success: false, error: error.message };
  }
}

// ─── FUNCIÓN PARA DESBANEAR ──────────────────────────────────────────────

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

// ─── FUNCIÓN PARA FORMATEAR DURACIÓN ─────────────────────────────────────

function parseDuration(input) {
  const match = input.match(/^(\d+)([smhdw])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    default: return null;
  }
}

function formatDuration(seconds) {
  if (seconds >= 604800) {
    const weeks = seconds / 604800;
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else if (seconds >= 86400) {
    const days = seconds / 86400;
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (seconds >= 3600) {
    const hours = seconds / 3600;
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (seconds >= 60) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}

// ─── COMANDO ──────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('gameban')
    .setDescription('🔨 Ban a user from the game (Staff only)')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Ban duration (e.g., 1h, 1d, 1w, permanent)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user');
      const durationInput = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason');

      // ─── OBTENER ROBLOX ID ──────────────────────────────────────────────

      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      // ─── PARSEAR DURACIÓN ───────────────────────────────────────────────

      let durationSeconds;
      let durationDisplay;

      if (durationInput.toLowerCase() === 'permanent') {
        durationSeconds = 315360000; // 10 años
        durationDisplay = 'permanent';
      } else {
        durationSeconds = parseDuration(durationInput);
        if (!durationSeconds) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: '❌ Invalid duration format. Use: `1s`, `10m`, `2h`, `3d`, `1w`, or `permanent`',
          });
        }
        durationDisplay = formatDuration(durationSeconds);
      }

      // ─── BANEAR ──────────────────────────────────────────────────────────

      const result = await banUserWithAlts(
        robloxId,
        durationSeconds,
        `Banned: ${reason}`,
        `Banned by ${interaction.user.tag}: ${reason}`
      );

      if (!result.success) {
        if (result.alreadyBanned) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `⚠️ **${robloxUsername}** is already banned from the game.`,
          });
        }
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to ban **${robloxUsername}**: ${result.error}`,
        });
      }

      // ─── EMBED DE CONFIRMACIÓN ──────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Game Ban')
        .setDescription(`✅ Successfully banned **${robloxUsername}** & all detected alts from the game!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '📋 Discord User', value: `${targetUser}`, inline: true },
          { name: '⏱️ Duration', value: `\`${durationDisplay}\``, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '👮 Banned by', value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: 'All alt accounts have been detected and banned automatically.' })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      logger.info(`[GameBan] ${interaction.user.tag} banned ${robloxUsername} (${robloxId}) for ${durationDisplay}: ${reason}`);

    } catch (error) {
      logger.error('GameBan error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};