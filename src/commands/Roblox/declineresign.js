import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { pendingResignations } from './resign.js';

const LOG_CHANNEL_ID = '1518724147763740784';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

export default {
  data: new SlashCommandBuilder()
    .setName('declineresign')
    .setDescription('Decline a pending resignation')
    .addUserOption(opt =>
      opt.setName('discorduser')
        .setDescription('Discord user whose resignation to decline')
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
      return await interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const resignation = pendingResignations.get(discordUser.id);

      if (!resignation) {
        return await interaction.editReply({
          content: `❌ No pending resignation found for **${discordUser.tag}**.`,
        });
      }

      pendingResignations.delete(discordUser.id);

      // ─── LOG EN EL CANAL ──────────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('<:EventIcon:1502787131611938947> Resignation Logs')
          .setColor(0x808080)
          .setDescription(`<@${interaction.user.id}> has **declined** the resignation of **${resignation.robloxUsername}**.`)
          .addFields(
            { 
              name: '\u200B', 
              value: `> **Roblox Username:** ${resignation.robloxUsername}\n> **Discord User:** <@${resignation.discordUserId}>\n> **Reason:** ${reason}\n> **Processed by:** <@${interaction.user.id}>`, 
              inline: false 
            },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      // ─── DM AL USUARIO ──────────────────────────────────────────────────────

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

      await interaction.editReply({
        content: `❌ Resignation for **${resignation.robloxUsername}** has been **declined**.`,
      });

      logger.info(`[DeclineResign] ${interaction.user.tag} declined resignation for ${resignation.robloxUsername}`);

    } catch (error) {
      logger.error('DeclineResign error:', error);
      await interaction.editReply({ content: '❌ An error occurred.' });
    }
  },
};