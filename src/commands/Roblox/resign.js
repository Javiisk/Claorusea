import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

const LOG_CHANNEL_ID = '1518724147763740784';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

// Store pending resignations (usando Discord ID como key)
export const pendingResignations = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('<:EventIcon:1502787131611938947> Log a resignation')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for resignation')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('notes')
        .setDescription('Additional notes')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Resign defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      // Guardar usando Discord ID como key
      pendingResignations.set(discordUser.id, {
        discordUserId: discordUser.id,
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        notes: notes,
        timestamp: new Date(),
      });

      // ─── LOG EMBED ────────────────────────────────────────────────────────────

      const logEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> Resignation Logs')
        .setColor(0x808080)
        .setDescription(`<@${interaction.user.id}> has **logged** a resignation of **${robloxUsername}**!`)
        .addFields(
          { 
            name: '\u200B', 
            value: `> **Roblox Username:** ${robloxUsername}\n> **Discord Username:** <@${discordUser.id}>\n> **Discord ID:** ${discordUser.id}\n> **Reason:** ${reason}\n> **Notes:** ${notes}`, 
            inline: false 
          },
          { 
            name: '\u200B', 
            value: `<:WarningIcon:1518051573069123728> • Use /acceptresign <@${discordUser.id}> or /declineresign <@${discordUser.id}> to process this resignation.`, 
            inline: false 
          },
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // ─── DM AL USUARIO ──────────────────────────────────────────────────────

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
          .setColor(0x808080)
          .setDescription(`Greetings, **${robloxUsername}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: '> Your resignation has been **logged**.', inline: false },
            { name: '\u200B', value: '**Thank you for working with us and have a good day/night.**', inline: false },
            { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
            { name: '\u200B', value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want.', inline: false },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await InteractionHelper.safeEditReply(interaction, { 
        content: `✅ Resignation for **${robloxUsername}** has been logged in <#${LOG_CHANNEL_ID}>.` 
      });

    } catch (error) {
      logger.error('Resign error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};