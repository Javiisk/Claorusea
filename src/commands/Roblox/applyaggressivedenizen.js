import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

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

export default {
  data: new SlashCommandBuilder()
    .setName('applyaggressivedenizen')
    .setDescription('Apply for Aggressive Denizen rank (must have gamepass)')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Your Discord user')
        .setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('ApplyAggressiveDenizen defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;
      const avatar = await getRobloxAvatar(robloxId);

      // Mandar DM con instrucciones y botón de verificar
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x1a0a0a)
          .setTitle('🌿 Aggressive Denizen Application')
          .setThumbnail(avatar)
          .setDescription(
            `Greetings, **${robloxUsername}**! Welcome to the application process.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `To become an **Aggressive Denizen** you must:\n\n` +
            `**Step 1 —** Purchase the Aggressive Denizen Gamepass on Roblox\n` +
            `**Step 2 —** Click the button below to verify your purchase\n\n` +
            `*The system will automatically check if you own the gamepass and rank you up instantly!*\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔑 • If you have already purchased it, go ahead and click **Verify Purchase**!`
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`aggressivedenizen_verify:${targetUser.id}:${robloxId}:${robloxUsername}`)
            .setLabel('Verify Purchase')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        );

        await targetUser.send({ embeds: [dmEmbed], components: [row] });
        await InteractionHelper.safeEditReply(interaction, {
          content: '🌿 Check your DMs! The application instructions have been sent.',
        });

      } catch {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not send you a DM. Please enable your DMs and try again.',
        });
      }

    } catch (error) {
      logger.error('ApplyAggressiveDenizen error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
