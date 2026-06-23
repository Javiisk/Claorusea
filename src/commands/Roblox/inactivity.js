import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1518037992927789126';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('inactivity')
    .setDescription('Register an inactivity notice 🚀')
    .addStringOption(opt =>
      opt.setName('robloxuser').setDescription('Roblox username').setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('discorduser').setDescription('Discord user').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('startdate').setDescription('Start date (MM/DD/YYYY)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('enddate').setDescription('End date (MM/DD/YYYY)').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for inactivity').setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Inactivity interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'inactivity',
      });
      return;
    }

    try {
      const robloxUser = interaction.options.getString('robloxuser');
      const discordUser = interaction.options.getUser('discorduser');
      const startDate = interaction.options.getString('startdate');
      const endDate = interaction.options.getString('enddate');
      const reason = interaction.options.getString('reason');

      // Embed para el canal de logs
      const logEmbed = new EmbedBuilder()
        .setTitle('🔔 Inactivity Logs')
        .setColor(0x5865F2)
        .setDescription(`<@${interaction.user.id}> has registered an inactivity notice of **${robloxUser}**! Information about this inactivity notice:`)
        .addFields(
          { name: '**Roblox Username:**', value: robloxUser, inline: false },
          { name: '**Start of inactivity notice:**', value: startDate, inline: false },
          { name: '**End of Inactivity Notice:**', value: endDate, inline: false },
          { name: '**Reason of inactivity notice:**', value: reason, inline: false },
        )
        .addFields(
          { name: '\u200B', value: '⚠️ • If it didn\'t register **correctly**, remember to use the command again and **inform** the staff why you received the bot\'s DM again.', inline: false },
          { name: '\u200B', value: `📋 • Remember that **${robloxUser}** cooldown to start another **inactivity** notice has begun: **2 Weeks.**`, inline: false },
        )
        .setTimestamp();

      // Embed para el DM del usuario
      const dmEmbed = new EmbedBuilder()
        .setTitle('🚀 ‿ Inactivity Period')
        .setColor(0x5865F2)
        .setDescription(`Greetings, **${robloxUser}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: `Your inactivity have been logged and will end in **${endDate}**`, inline: false },
          { name: '\u200B', value: 'Enjoy your break!', inline: false },
          { name: '\u200B', value: '⚠️ • If you didn\'t request an inactivity notice, please ping a **Domain+** to correct this.', inline: false },
          { name: '\u200B', value: `Enjoy your break **${robloxUser}**!`, inline: false },
        )
        .setTimestamp();

      // Enviar al canal de logs
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });

      // Enviar DM al usuario de Discord
      try {
        await discordUser.send({ embeds: [dmEmbed] });
      } catch {
        await InteractionHelper.safeEditReply(interaction, {
          content: `⚠️ Inactivity logged but couldn't send DM to <@${discordUser.id}> (they may have DMs disabled).`,
        });
        return;
      }

      // Respuesta de confirmación
      const confirmEmbed = createEmbed({ title: '✅ Inactivity Registered', description: null })
        .setDescription(`Inactivity notice for **${robloxUser}** has been registered and DM sent to <@${discordUser.id}>.`)
        .addFields(
          { name: 'Start Date', value: startDate, inline: true },
          { name: 'End Date', value: endDate, inline: true },
        )
        .setColor(0x57F287)
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [confirmEmbed] });

    } catch (error) {
      logger.error('Inactivity command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
