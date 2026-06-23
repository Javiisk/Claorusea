import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const LOG_CHANNEL_ID = '1518724147763740784';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const ESTEEMED_DENIZEN_RANK_ID = 2;

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

async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return data.roles || [];
}

async function setRankById(userId, rankNumber) {
  try {
    const roles = await getGroupRoles();
    const role = roles.find(r => r.rank === rankNumber);
    if (!role) return { success: false, error: `Rank ${rankNumber} not found.` };

    const res = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?filter=user=='users/${userId}'`,
      { headers: { 'x-api-key': API_KEY } }
    );
    const data = await res.json();
    let membership = data.groupMemberships?.[0];

    if (!membership) {
      const res2 = await fetch(
        `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships?maxPageSize=1&filter=user==users/${userId}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      const data2 = await res2.json();
      membership = data2.groupMemberships?.[0];
      if (!membership) return { success: false, error: 'User is not in the group.' };
    }

    const membershipId = membership.path.split('/').pop();
    const updateRes = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: `groups/${GROUP_ID}/roles/${role.id}` }),
      }
    );

    if (updateRes.ok) return { success: true, roleName: role.name };
    const err = await updateRes.json();
    return { success: false, error: err.message || 'Failed to update rank.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
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

      // Embed para el canal de resignations
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

      // Botones Accept / Decline
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resign_decline_${discordUser.id}_${roblox.id}_${robloxUser}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️'),
        new ButtonBuilder()
          .setCustomId(`resign_accept_${discordUser.id}_${roblox.id}_${robloxUser}`)
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
      } catch {
        // DMs disabled, continue anyway
      }

      await InteractionHelper.safeEditReply(interaction, { content: `✅ Resignation for **${robloxUser}** has been logged in <#${LOG_CHANNEL_ID}>.` });

    } catch (error) {
      logger.error('Resign command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },

  // Manejador de botones e interacciones
  async handleButton(interaction) {
    const [, action, discordUserId, robloxId, robloxUser] = interaction.customId.split('_');

    if (action === 'accept') {
      await interaction.deferUpdate();

      // Bajar rango en Roblox
      const rankResult = await setRankById(parseInt(robloxId), ESTEEMED_DENIZEN_RANK_ID);

      // DM al usuario aceptado
      try {
        const discordUser = await interaction.client.users.fetch(discordUserId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('🚀 ‿ Resignation Notice')
          .setColor(0x57F287)
          .setDescription(`Greetings, **${robloxUser}**! We are here to inform you that:`)
          .addFields(
            { name: '\u200B', value: 'Your resignation has been logged just like you already got ranked to **Esteemed Denizen**.', inline: false },
            { name: '\u200B', value: '**Thank you for working with us and have a good day/night.**', inline: false },
            { name: '\u200B', value: '⚠️ • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
            { name: '\u200B', value: '📋 • Remember you can **return** to the **staff team** whenever you want, just **apply** or purchase **Game Pass** again.', inline: false },
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      // Actualizar embed en el canal deshabilitando botones
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done').setLabel('Accepted ✔️').setStyle(ButtonStyle.Success).setDisabled(true),
      );

      await interaction.editReply({ components: [updatedRow] });

      if (!rankResult.success) {
        await interaction.followUp({ content: `⚠️ Resignation accepted but failed to change rank: ${rankResult.error}`, ephemeral: true });
      }
    }

    if (action === 'decline') {
      // Abrir modal para pedir razón
      const modal = new ModalBuilder()
        .setCustomId(`resign_modal_${discordUserId}_${robloxId}_${robloxUser}`)
        .setTitle('Why decline this resignation.');

      const reasonInput = new TextInputBuilder()
        .setCustomId('decline_reason')
        .setLabel('Why you declined this resignation.')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('notes')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const [, , discordUserId, robloxId, robloxUser] = interaction.customId.split('_');
    const declineReason = interaction.fields.getTextInputValue('decline_reason');

    await interaction.deferUpdate();

    // DM al usuario declinado
    try {
      const discordUser = await interaction.client.users.fetch(discordUserId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('🚀 ‿ Resignation Notice')
        .setColor(0xED4245)
        .setDescription(`Greetings, **${robloxUser}**! We are here to inform you that:`)
        .addFields(
          { name: '\u200B', value: 'Your resignation has been **declined**.', inline: false },
          { name: 'Reason:', value: declineReason, inline: false },
          { name: '\u200B', value: '⚠️ • If you think this high rank made a **mistake**, ping a **Domain+**.', inline: false },
          { name: '\u200B', value: '⚠️ • If you didn\'t request a resignation, please ping a **Domain+** to correct this.', inline: false },
        )
        .setTimestamp();
      await discordUser.send({ embeds: [dmEmbed] });
    } catch { /* DMs disabled */ }

    // Actualizar embed deshabilitando botones
    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('done').setLabel('Declined ✖️').setStyle(ButtonStyle.Danger).setDisabled(true),
    );

    await interaction.editReply({ components: [updatedRow] });
  },
};
