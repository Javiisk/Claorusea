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
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserByDiscord } from '../../utils/bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');
const LOG_CHANNEL_ID = '1547414356210225203';

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription("Removes a number of warnings from a user's MyInfo")
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The Discord user to remove warnings from')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('How many warnings to remove (most recent first)')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
      const db = loadDB();
      const key = targetUser.id;
      const userEntry = db[key];

      if (!userEntry || !userEntry.warnings || userEntry.warnings.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have any warnings.`,
        });
      }

      const previousTotal = userEntry.warnings.length;
      const removedCount = Math.min(amount, previousTotal);

      // Removes the most recently added warnings first.
      const removedWarnings = userEntry.warnings.splice(-removedCount, removedCount);
      saveDB(db);

      logger.info(`[ClearWarn] Removed ${removedCount} warning(s) from ${targetUser.tag}. Remaining: ${userEntry.warnings.length}. By: ${interaction.user.tag}`);

      // ─── LOG CONTAINER (Components V2) — logged only, nothing sent to the user ──
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

      if (!logChannel) {
        logger.error(`[ClearWarn] Could not find/access the log channel with ID ${LOG_CHANNEL_ID}.`);
      } else {
        let robloxUsername = userEntry.username;
        if (!robloxUsername) {
          const bloxlinkData = await getRobloxUserByDiscord(targetUser.id).catch(() => null);
          robloxUsername = bloxlinkData?.primaryAccount || 'Unknown';
        }

        const removedReasonsText = removedWarnings
          .map(w => `**#${w.id}** - ${w.reason} *(by ${w.moderator})*`)
          .join('\n');

        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### Warnings Cleared'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**User**\n<@${targetUser.id}> (${targetUser.tag})`,
                '',
                `**Roblox User**\n${robloxUsername}`,
                '',
                `**Removed**\n${removedCount} warning(s)`,
                '',
                `**Remaining**\n${userEntry.warnings.length}`,
                '',
                `**Moderator**\n${interaction.user.tag}`,
                '',
                `**Removed Warnings**\n${removedReasonsText || 'N/A'}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch((error) => {
          logger.error('[ClearWarn] Failed to send the log message:', error);
        });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Removed ${removedCount} warning(s) from **${targetUser.tag}**. Remaining: ${userEntry.warnings.length}.`,
      });

    } catch (error) {
      logger.error('ClearWarn command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while executing the clearwarn command.',
      });
    }
  },
};
