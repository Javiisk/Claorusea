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
import { getRobloxUserByDiscord } from '../../utils/bloxlink.js'; // ✅ CORREGIDO

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Add a warning to a user (Updates their MyInfo)')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The Discord user to warn')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot warn yourself.'
      });
    }

    try {
      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);

      if (!bloxlinkData || !bloxlinkData.robloxID) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked. Cannot add the warning.`,
        });
      }

      const robloxId = String(bloxlinkData.robloxID);
      const robloxUsername = bloxlinkData.primaryAccount || `User_${robloxId}`;

      const db = loadDB();
      const key = targetUser.id;

      if (!db[key]) {
        db[key] = {
          discordId: targetUser.id,
          robloxId: robloxId,
          username: robloxUsername,
          trained: false,
          warnings: [],
          blacklisted: false,
          blacklistReason: null
        };
      } else {
        db[key].robloxId = robloxId;
        db[key].username = robloxUsername;
      }

      const newWarn = {
        id: db[key].warnings.length + 1,
        reason: reason,
        moderator: interaction.user.tag,
        date: new Date().toISOString()
      };

      db[key].warnings.push(newWarn);
      saveDB(db);

      logger.info(`[Warn] ${targetUser.tag} (${robloxUsername}) warned. Total: ${db[key].warnings.length}. Reason: ${reason}`);

      // ─── DM CONTAINER (Components V2) ────────────────────────────────
      const issuedTimestamp = Math.floor(Date.now() / 1000);

      const dmContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### <:WarningIcon:1547447355576684604> You have received a warning'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Reason**\n${reason}`),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Issued**\n<t:${issuedTimestamp}:F>`),
        );

      let dmError = false;
      try {
        await targetUser.send({
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (dmError_) {
        dmError = true;
        logger.warn(`[Warn] Could not send DM to ${targetUser.tag}. DMs are closed.`);
      }

      // ─── SUCCESS CONTAINER (Components V2) ───────────────────────────
      const successContainer = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('### ✅ Warning Applied'),
        )
        .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `A warning has been added to **${targetUser.tag}**.`,
          ),
        )
        .addSeparatorComponents(separator =>
          separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `**Roblox User**\n${robloxUsername}`,
              '',
              `**Reason**\n${reason}`,
              '',
              `**Total Warnings**\n${db[key].warnings.length}`,
              '',
              `**DM Notification**\n${dmError ? '❌ Not sent (DMs closed)' : '✅ Sent successfully'}`,
            ].join('\n'),
          ),
        );

      await InteractionHelper.safeEditReply(interaction, {
        components: [successContainer],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      logger.error('Warn command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while executing the warning command.',
      });
    }
  },
};
