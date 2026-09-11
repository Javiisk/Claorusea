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
const LOG_CHANNEL_ID = '1530033235403210762';

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

    const container = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          success ? '### 🔓 Game Unban' : '### ⚠️ Game Unban Failed',
        ),
      )
      .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            success
              ? `✅ Successfully unbanned **${robloxUsername}** from the game!`
              : `❌ Failed to unban **${robloxUsername}**`,
            '',
            `**Roblox User**\n${robloxUsername}`,
            '',
            `**Roblox ID**\n${robloxId}`,
            '',
            `**Unbanned by**\n${interaction.user} (${interaction.user.tag})`,
          ].join('\n'),
        ),
      );

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
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

      const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### 🔓 Game Unban'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `✅ Successfully unbanned **${robloxName}** from the game!`,
              '',
              `**Roblox User**\n${robloxName}`,
              '',
              `**Roblox ID**\n${robloxId}`,
              '',
              `**Unbanned by**\n${interaction.user}`,
            ].join('\n'),
          ),
        );

      await InteractionHelper.safeEditReply(interaction, {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      logger.info(`[GameUnban] ${interaction.user.tag} unbanned ${robloxName}`);

    } catch (error) {
      logger.error('GameUnban error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};
