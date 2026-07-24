import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserByDiscord, getRobloxUsernameById } from './bloxlink.js';

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

// ─── FUNCIÓN PARA OBTENER ROBLOX USER ──────────────────────────────────

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

// ─── FUNCIÓN PARA BANEAR ──────────────────────────────────────────────────

async function banUserWithAlts(userId, durationSeconds, displayReason, privateReason) {
  try {
    const url = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/user-restrictions/${userId}`;
    
    const body = {
      gameJoinRestriction: {
        active: true,
        duration: `${durationSeconds}s`,
        displayReason: displayReason || 'Banned by staff.',
        privateReason: privateReason || 'No reason provided.',
        excludeAltAccounts: false,
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
    return { success: false, error: error.message };
  }
}

// ─── FUNCIÓN PARA ENVIAR LOG ─────────────────────────────────────────────

async function sendLog(interaction, robloxUsername, robloxId, durationDisplay, reason, success) {
  try {
    const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(success ? 0xED4245 : 0xF1C40F)
      .setTitle(success ? '🔨 Game Ban' : '⚠️ Game Ban Failed')
      .setDescription(success 
        ? `✅ Successfully banned **${robloxUsername}** & all detected alts from the game!`
        : `❌ Failed to ban **${robloxUsername}**`
      )
      .addFields(
        { name: '👤 Roblox User', value: robloxUsername, inline: true },
        { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
        { name: '⏱️ Duration', value: `\`${durationDisplay}\``, inline: true },
        { name: '📝 Reason', value: reason, inline: false },
        { name: '👮 Banned by', value: `${interaction.user} (${interaction.user.tag})`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('[GameBan] Log error:', error);
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
    .setDescription('🔨 Ban a user from the game by Roblox username (Staff only)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('robloxuser')
        .setDescription('Roblox username to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Ban duration (1s, 10m, 2h, 3d, 1w, permanent)')
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

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('GameBan interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId || 'DM',
        commandName: 'gameban',
      });
      return;
    }

    try {
      const robloxUsername = interaction.options.getString('robloxuser');
      const durationInput = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason');

      const roblox = await getRobloxUser(robloxUsername);
      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      const robloxId = roblox.id;
      const robloxName = roblox.name;

      let durationSeconds;
      let durationDisplay;

      if (durationInput.toLowerCase() === 'permanent') {
        durationSeconds = 315360000;
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

      const result = await banUserWithAlts(
        robloxId,
        durationSeconds,
        `Banned: ${reason}`,
        `Banned by ${interaction.user.tag}: ${reason}`
      );

      await sendLog(interaction, robloxName, robloxId, durationDisplay, reason, result.success);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to ban **${robloxName}**: ${result.error}`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Game Ban')
        .setDescription(`✅ Successfully banned **${robloxName}** & all detected alts from the game!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxName, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '⏱️ Duration', value: `\`${durationDisplay}\``, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '👮 Banned by', value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: 'All alt accounts have been detected and banned automatically.' })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      logger.info(`[GameBan] ${interaction.user.tag} banned ${robloxName} (${robloxId}) for ${durationDisplay}: ${reason}`);

    } catch (error) {
      logger.error('GameBan command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while banning the user.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};