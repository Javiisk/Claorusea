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

// Store pending resignations
const pendingResignations = new Map();

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
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Resign interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'resign' });
      return;
    }

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      // Generate a unique ID for this resignation
      const resignationId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

      // Store pending resignation
      pendingResignations.set(resignationId, {
        discordUserId: discordUser.id,
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        notes: notes,
        timestamp: new Date(),
      });

      // ✅ LOG EMBED - Con emojis personalizados
      const logEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> Resignation Log')
        .setColor(0x808080)
        .setDescription(`<@${interaction.user.id}> has **logged** a resignation.`)
        .addFields(
          { name: '<:SurveyIcon:1502787137278312499> Roblox Username', value: robloxUsername, inline: false },
          { name: '<:AddIcon:1538060207396098130> Discord Username', value: `<@${discordUser.id}>`, inline: false },
          { name: '<:AddIcon:1538060207396098130> Discord ID', value: discordUser.id, inline: false },
          { name: '<:SurveyIcon:1502787137278312499> Reason', value: reason, inline: false },
          { name: ':PaperPlaneIcon: Notes', value: notes, inline: false },
          { 
            name: '\u200B', 
            value: `<:WarningIcon:1518051573069123728> **Remember to read all the information and click the reject button if they entered incorrect information**`, 
            inline: false 
          },
          { 
            name: '\u200B', 
            value: `<:WarningIcon:1518051573069123728> **Use /acceptresign ${resignationId}** or **/declineresign ${resignationId}** to process this resignation.**`, 
            inline: false 
          },
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // DM al usuario que se resigna
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
          .setColor(0x808080)
          .setDescription(`Greetings, **${robloxUsername}**! We are here to inform you that:`)
          .addFields(
            { 
              name: '\u200B', 
              value: '> Your resignation has been **logged** just like you already got ranked to **Inhabitant**.', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '**Thank you for working with us and have a good day/night.**', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', 
              inline: false 
            },
            { 
              name: '\u200B', 
              value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want, just **apply** or purchase **Game Pass** again.', 
              inline: false 
            },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await InteractionHelper.safeEditReply(interaction, { 
        content: `✅ Resignation for **${robloxUsername}** has been logged in <#${LOG_CHANNEL_ID}>. Use \`/acceptresign ${resignationId}\` or \`/declineresign ${resignationId}\` to process it.` 
      });

    } catch (error) {
      logger.error('Resign command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};

// ─── ACCEPT RESIGN COMMAND ──────────────────────────────────────────────

export const acceptResign = {
  data: new SlashCommandBuilder()
    .setName('acceptresign')
    .setDescription('<:VerifiedIcon:1502787139845230622> Accept a pending resignation')
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('Resignation ID from the log')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const id = interaction.options.getString('id');
    const resignation = pendingResignations.get(id);

    if (!resignation) {
      return await interaction.editReply({
        content: '❌ Invalid resignation ID. It may have already been processed.',
      });
    }

    pendingResignations.delete(id);

    const embed = new EmbedBuilder()
      .setTitle('<:VerifiedIcon:1502787139845230622> Resignation Accepted')
      .setColor(0x808080)
      .setDescription(`Resignation for **${resignation.robloxUsername}** has been **accepted**.`)
      .addFields(
        { name: '<:AddIcon:1538060207396098130> Moderator', value: `<@${interaction.user.id}>`, inline: false },
        { name: '📅 Processed', value: new Date().toLocaleString(), inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify the user
    try {
      const user = await interaction.client.users.fetch(resignation.discordUserId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
        .setColor(0x808080)
        .setDescription(`Greetings, **${resignation.robloxUsername}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: '> Your resignation has been **accepted**.', inline: false },
          { name: '\u200B', value: '**Thank you for working with us and have a good day/night.**', inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
          { name: '\u200B', value: '<:SurveyIcon:1502787137278312499> • Remember you can **return** to the **staff team** whenever you want, just **apply** or purchase **Game Pass** again.', inline: false },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch { /* DMs disabled */ }

    logger.info(`[Resign] ${interaction.user.tag} accepted resignation for ${resignation.robloxUsername}`);
  },
};

// ─── DECLINE RESIGN COMMAND ─────────────────────────────────────────────

export const declineResign = {
  data: new SlashCommandBuilder()
    .setName('declineresign')
    .setDescription('<:UnverifiedIcon:1502787138700443668> Decline a pending resignation')
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('Resignation ID from the log')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for declining')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const id = interaction.options.getString('id');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const resignation = pendingResignations.get(id);

    if (!resignation) {
      return await interaction.editReply({
        content: '❌ Invalid resignation ID. It may have already been processed.',
      });
    }

    pendingResignations.delete(id);

    const embed = new EmbedBuilder()
      .setTitle('<:UnverifiedIcon:1502787138700443668> Resignation Declined')
      .setColor(0x808080)
      .setDescription(`Resignation for **${resignation.robloxUsername}** has been **declined**.`)
      .addFields(
        { name: '<:AddIcon:1538060207396098130> Moderator', value: `<@${interaction.user.id}>`, inline: false },
        { name: '<:SurveyIcon:1502787137278312499> Reason', value: reason, inline: false },
        { name: '📅 Processed', value: new Date().toLocaleString(), inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify the user
    try {
      const user = await interaction.client.users.fetch(resignation.discordUserId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('<:EventIcon:1502787131611938947> 𓂃 Resignation Notice')
        .setColor(0x808080)
        .setDescription(`Greetings, **${resignation.robloxUsername}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: '> Your resignation has been **declined**.', inline: false },
          { name: '\u200B', value: `> **Reason:** ${reason}`, inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
          { name: '\u200B', value: '<:WarningIcon:1518051573069123728> • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch { /* DMs disabled */ }

    logger.info(`[Resign] ${interaction.user.tag} declined resignation for ${resignation.robloxUsername}`);
  },
};