import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFERS_PATH = join(__dirname, '../../../offers.json');

// ✅ SIN ALLOWED_ROLES - Cualquier miembro del servidor puede aceptar

function loadOffers() {
  if (!existsSync(OFFERS_PATH)) {
    writeFileSync(OFFERS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
}

function saveOffers(offers) {
  writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2));
}

async function getGroupRoles() {
  const groupId = process.env.ROBLOX_GROUP_ID;
  const apiKey = process.env.ROBLOX_API_KEY;
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await res.json();
  return data.roles || [];
}

async function setRankByRoleId(userId, roleId) {
  try {
    const groupId = process.env.ROBLOX_GROUP_ID;
    const apiKey = process.env.ROBLOX_API_KEY;
    
    const res = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=user=='users/${userId}'`,
      { headers: { 'x-api-key': apiKey } }
    );
    const data = await res.json();
    let membership = data.groupMemberships?.[0];

    if (!membership) {
      const res2 = await fetch(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=1&filter=user==users/${userId}`,
        { headers: { 'x-api-key': apiKey } }
      );
      const data2 = await res2.json();
      membership = data2.groupMemberships?.[0];
      if (!membership) return { success: false, error: 'User is not in the group.' };
    }

    const membershipId = membership.path.split('/').pop();
    const updateRes = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: `groups/${groupId}/roles/${roleId}` }),
      }
    );

    if (updateRes.ok) return { success: true };
    const err = await updateRes.json();
    return { success: false, error: err.message || 'Failed.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('✅ Accept a pending rank offer')
    .addStringOption(option =>
      option.setName('offer_id')
        .setDescription('The offer ID')
        .setRequired(true)),

  async execute(interaction) {
    // ✅ SIN ALLOWED_ROLES - Cualquier miembro del servidor puede aceptar

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const offerId = interaction.options.getString('offer_id');
      const offers = loadOffers();

      if (!offers[offerId]) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Offer **${offerId}** not found.`,
        });
      }

      const offer = offers[offerId];

      if (Date.now() > offer.expiresAt) {
        offer.status = 'expired';
        saveOffers(offers);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Offer **${offerId}** has expired.`,
        });
      }

      if (offer.status !== 'pending') {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Offer **${offerId}** is already ${offer.status}.`,
        });
      }

      // ─── OBTENER ID DEL RANGO ──────────────────────────────────────────

      const roles = await getGroupRoles();
      const role = roles.find(r => r.name === offer.rank);
      
      if (!role) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Rank "${offer.rank}" not found in the group.`,
        });
      }

      // ─── CAMBIAR EL RANGO EN ROBLOX ────────────────────────────────────

      const result = await setRankByRoleId(offer.robloxId, role.id);

      if (!result.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank: ${result.error}`,
        });
      }

      offer.status = 'accepted';
      saveOffers(offers);

      // ─── ENVIAR DM AL USUARIO ──────────────────────────────────────────

      try {
        const discordUser = await interaction.client.users.fetch(offer.discordId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Rank Offer Accepted')
          .setDescription(`Your rank offer has been **ACCEPTED**!`)
          .addFields(
            { name: '👤 Roblox User', value: offer.robloxUsername, inline: true },
            { name: '📊 Rank', value: offer.rank, inline: true },
            { name: '✅ Accepted by', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn(`[Accept] Could not DM user: ${dmError.message}`);
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ **${offer.robloxUsername}** has been promoted to **${offer.rank}**!`,
      });

      logger.info(`[Accept] ${interaction.user.tag} accepted offer ${offerId}`);

    } catch (error) {
      logger.error('Accept error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};