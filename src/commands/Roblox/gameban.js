import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1547417292806160434';

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

async function sendLog(interaction, robloxUsername, robloxId, durationDisplay, reason, success) {
  try {
    const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const container = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          success ? '### 🔨 Game Ban' : '### ⚠️ Game Ban Failed',
        ),
      )
      .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            success
              ? `✅ Successfully banned **${robloxUsername}** & all detected alts from the game!`
              : `❌ Failed to ban **${robloxUsername}**`,
            '',
            `**Roblox User**\n${robloxUsername}`,
            '',
            `**Roblox ID**\n${robloxId}`,
            '',
            `**Duration**\n\`${durationDisplay}\``,
            '',
            `**Reason**\n${reason}`,
            '',
            `**Banned by**\n${interaction.user} (${interaction.user.tag})`,
          ].join('\n'),
        ),
      );

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    logger.error('[GameBan] Log error:', error);
  }
}

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

      const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### 🔨 Game Ban'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `✅ Successfully banned **${robloxName}** & all detected alts from the game!`,
              '',
              `**Roblox User**\n${robloxName}`,
              '',
              `**Roblox ID**\n${robloxId}`,
              '',
              `**Duration**\n\`${durationDisplay}\``,
              '',
              `**Reason**\n${reason}`,
              '',
              `**Banned by**\n${interaction.user}`,
            ].join('\n'),
          ),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '-# All alt accounts have been detected and banned automatically.',
          ),
        );

      await InteractionHelper.safeEditReply(interaction, {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

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
