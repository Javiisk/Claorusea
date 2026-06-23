import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1518724147763740784';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('resign')
    .setDescription('Log a resignation 🚀')
    .addStringOption(opt =>
      opt.setName('robloxuser').setDescription('Roblox username').setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('discorduser').setDescription('Discord user').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for resignation').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('notes').setDescription('Additional notes').setRequired(false)
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
      const robloxUser = interaction.options.getString('robloxuser');
      const discordUser = interaction.options.getUser('discorduser');
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      const roblox = await getRobloxUser(robloxUser);
      if (!roblox) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Roblox user not found.' });

      // Usamos : como separador para que el bot lo detecte correctamente
      const logEmbed = new EmbedBuilder()
        .setTitle('⚠️ Resignation Log')
        .setColor(0x5865F2)
        .setDescription(`<@${interaction.user.id}> Has **logged** a resignation, **information** regarding his **resignation**:`)
        .addFields(
          { name: 'Roblox Username:', value: robloxUser, inline: false },
          { name: 'Discord Username:', value: `<@${discordUser.id}>`, inline: false },
          { name: 'Discord ID:', value: discordUser.id, inline: false },
          { name: 'Reason:', value: reason, inline: false },
          { name: 'Notes:', value: notes, inline: false },
          { name: '\u200B', value: '⚠️ **Remember to read all the information and click the reject button if they entered incorrect or incorrect information**', inline: false },
        )
        .setTimestamp();

      // customId usa : como separador → resign_decline:discordUserId:robloxId:robloxUser
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resign_decline:${discordUser.id}:${roblox.id}:${robloxUser}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️'),
        new ButtonBuilder()
          .setCustomId(`resign_accept:${discordUser.id}:${roblox.id}:${robloxUser}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️'),
      );

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) await logChannel.send({ embeds: [logEmbed], components: [row] });

      // DM al usuario que se resigna
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🚀 ‿ Resignation Notice')
          .setColor(0x5865F2)
          .setDescription(`Greetings, **${robloxUser}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: 'Your resignation has been **logged** and is being reviewed by staff.', inline: false },
            { name: '\u200B', value: '⚠️ • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      await InteractionHelper.safeEditReply(interaction, { content: `✅ Resignation for **${robloxUser}** has been logged in <#${LOG_CHANNEL_ID}>.` });

    } catch (error) {
      logger.error('Resign command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
