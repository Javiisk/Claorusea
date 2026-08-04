import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1504301603262566440';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('dmuser')
    .setDescription('📩 Send a DM to any Discord user (by ID)')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('Discord User ID (not username)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const userId = interaction.options.getString('user_id');
      const messageContent = interaction.options.getString('message');

      // ─── VALIDAR QUE EL ID SEA VÁLIDO ──────────────────────────────────

      if (!/^\d{17,20}$/.test(userId)) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Invalid Discord User ID. Must be a 17-20 digit number.',
        });
      }

      // ─── OBTENER USUARIO ──────────────────────────────────────────────

      let user;
      try {
        user = await interaction.client.users.fetch(userId);
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ User not found. Please check the ID.',
        });
      }

      // ─── ENVIAR MENSAJE ────────────────────────────────────────────────

      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📩 Message from Staff')
        .setDescription(messageContent)
        .addFields(
          { name: '📨 Sent by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
          { name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Reply to this staff member if needed.' })
        .setTimestamp();

      try {
        await user.send({ embeds: [dmEmbed] });
      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Could not send DM to **${user.tag}**. They may have DMs disabled or are not accepting messages.`,
        });
      }

      // ─── LOG AL CANAL ──────────────────────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('📩 DM Sent')
          .setDescription(`Staff sent a DM to **${user.tag}** (${user.id})`)
          .addFields(
            { name: '📝 Message', value: messageContent, inline: false },
            { name: '👤 Sent by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ DM sent to **${user.tag}** (${user.id})`,
      });

      logger.info(`[DMUser] ${interaction.user.tag} sent DM to ${user.tag} (${user.id})`);

    } catch (error) {
      logger.error('DMUser error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred while sending the DM.',
        ephemeral: true,
      });
    }
  },
};