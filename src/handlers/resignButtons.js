import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { logger } from '../utils/logger.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const ESTEEMED_DENIZEN_RANK = 2;

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

const resignAcceptHandler = {
  name: 'resign_accept',
  async execute(interaction, client) {
    try {
      const parts = interaction.customId.split('_');
      const discordUserId = parts[2];
      const robloxId = parts[3];
      const robloxUser = parts[4];

      await interaction.deferUpdate();

      // Bajar rango en Roblox
      const rankResult = await setRankById(parseInt(robloxId), ESTEEMED_DENIZEN_RANK);

      // DM al usuario aceptado
      try {
        const { EmbedBuilder } = await import('discord.js');
        const discordUser = await client.users.fetch(discordUserId);
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

      // Deshabilitar botones
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('resign_done')
          .setLabel('Accepted ✔️')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
      );

      await interaction.editReply({ components: [updatedRow] });

      if (!rankResult.success) {
        await interaction.followUp({ content: `⚠️ Resignation accepted but failed to change rank: ${rankResult.error}`, ephemeral: true });
      }

    } catch (error) {
      logger.error('Resign accept button error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

const resignDeclineHandler = {
  name: 'resign_decline',
  async execute(interaction, client) {
    try {
      const parts = interaction.customId.split('_');
      const discordUserId = parts[2];
      const robloxId = parts[3];
      const robloxUser = parts[4];

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

    } catch (error) {
      logger.error('Resign decline button error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

export { resignAcceptHandler, resignDeclineHandler };
