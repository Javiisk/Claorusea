import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const LOG_CHANNEL_ID = '1518724147763740784';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('Log a resignation 🚀')
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

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxUsername = userInfo.username;
      const robloxId = userInfo.id;

      const logEmbed = new EmbedBuilder()
        .setTitle('⚠️ Resignation Log')
        .setColor(0x5865F2)
        .setDescription(`<@${interaction.user.id}> Has **logged** a resignation.`)
        .addFields(
          { name: 'Roblox Username:', value: robloxUsername, inline: false },
          { name: 'Roblox ID:', value: String(robloxId), inline: false },
          { name: 'Discord Username:', value: `<@${discordUser.id}>`, inline: false },
          { name: 'Discord ID:', value: discordUser.id, inline: false },
          { name: 'Reason:', value: reason, inline: false },
          { name: 'Notes:', value: notes, inline: false },
          { name: '\u200B', value: '⚠️ **Remember to read all the information and click the reject button if they entered incorrect information**', inline: false },
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resign_decline:${discordUser.id}:${robloxId}:${robloxUsername}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️'),
        new ButtonBuilder()
          .setCustomId(`resign_accept:${discordUser.id}:${robloxId}:${robloxUsername}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️'),
      );

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed], components: [row] });

      // DM al usuario que se resigna
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🚀 Resignation Notice')
          .setColor(0x5865F2)
          .setDescription(`Greetings, **${robloxUsername}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: 'Your resignation has been **logged** and is being reviewed by staff.', inline: false },
            { name: '\u200B', value: '⚠️ • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await InteractionHelper.safeEditReply(interaction, { 
        content: `✅ Resignation for **${robloxUsername}** has been logged in <#${LOG_CHANNEL_ID}>.` 
      });

    } catch (error) {
      logger.error('Resign command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
