import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';

const GAMEPASS_ID = '1890892397';
const AGGRESSIVE_DENIZEN_RANK = 3;
const LOG_CHANNEL_ID = '1519207020299812936';
const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;

async function checkGamepass(userId) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${GAMEPASS_ID}`);
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch {
    return false;
  }
}

async function getRobloxAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
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
    return { success: false, error: err.message || 'Failed.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

const aggressiveDenizenVerifyHandler = {
  name: 'aggressivedenizen_verify',
  async execute(interaction, client, args) {
    try {
      const [discordUserId, robloxId, robloxUser] = args;

      // Solo el mismo usuario puede verificar
      if (interaction.user.id !== discordUserId) {
        return await interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
      }

      await interaction.deferUpdate();

      const hasGamepass = await checkGamepass(robloxId);

      if (!hasGamepass) {
        const noPassEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🌿 Aggressive Denizen Application')
          .setDescription(
            `Greetings, **${robloxUser}**!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `❌ We could not detect the **Aggressive Denizen Gamepass** on your account.\n\n` +
            `Please make sure you have purchased it and try again.\n\n` +
            `🔑 • If you just purchased it, wait a few minutes and try again.`
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`aggressivedenizen_verify:${discordUserId}:${robloxId}:${robloxUser}`)
            .setLabel('Try Again')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),
        );

        return await interaction.editReply({ embeds: [noPassEmbed], components: [row] });
      }

      // Tiene el gamepass, subirlo de rango
      const rankResult = await setRankById(parseInt(robloxId), AGGRESSIVE_DENIZEN_RANK);

      const avatar = await getRobloxAvatar(robloxId);

      if (rankResult.success) {
        // DM de bienvenida
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🌿 Aggressive Denizen')
          .setThumbnail(avatar)
          .setDescription(
            `Greetings, **${robloxUser}**!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Your purchase has been verified and you have been ranked to **Aggressive Denizen**.\n\n` +
            `Welcome to the camp, we hope you enjoy your stay at **Whispering Pines**!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔑 • Remember to read the rules and enjoy your experience.`
          )
          .setTimestamp();

        const doneRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('aggressivedenizen_done:done')
            .setLabel('Ranked! ✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        );

        await interaction.editReply({ embeds: [welcomeEmbed], components: [doneRow] });

        // Log en el canal
        try {
          const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
          const logEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🌿 Aggressive Denizen Log')
            .setThumbnail(avatar)
            .addFields(
              { name: 'Roblox User', value: robloxUser, inline: false },
              { name: 'Discord', value: `<@${discordUserId}>`, inline: false },
              { name: 'Rank', value: 'Aggressive Denizen', inline: false },
              { name: 'Gamepass', value: '✅ Verified', inline: false },
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        } catch { /* channel error */ }

      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🌿 Aggressive Denizen Application')
          .setDescription(
            `Greetings, **${robloxUser}**!\n\n` +
            `✅ Gamepass verified! But there was an error ranking you up.\n\n` +
            `**Error:** ${rankResult.error}\n\n` +
            `Please contact a staff member for assistance.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed], components: [] });
      }

    } catch (error) {
      logger.error('AggressiveDenizen verify error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
    }
  },
};

export { aggressiveDenizenVerifyHandler };
