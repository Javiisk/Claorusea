import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from '../../utils/bloxlink.js';

const GAMEPASS_ID = '1890892397';
const AGGRESSIVE_DENIZEN_RANK = 3;
const LOG_CHANNEL_ID = '1547416553623126096';
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
    .setName('exchanges')
    .setDescription('Exchange your Aggressive Denizen gamepass purchase for the rank'),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Exchanges defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      // ─── STEP 1: let the user know we're checking ────────────────────
      await InteractionHelper.safeEditReply(interaction, {
        content: '🔍 Looking for gamepass...',
      });

      const userInfo = await getRobloxUserInfoByDiscord(interaction.user.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ You do not have a Roblox account linked in this server.',
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const ownsGamepass = await checkGamepass(robloxId);

      if (!ownsGamepass) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ You do not own the required gamepass yet. Purchase it and try again.',
        });
      }

      const rankResult = await setRankById(robloxId, AGGRESSIVE_DENIZEN_RANK);

      if (!rankResult.success) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to rank you up: ${rankResult.error}`,
        });
      }

      // ─── LOG CONTAINER (Components V2) ────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### Gamepass Exchange'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `<@${interaction.user.id}> exchanged their gamepass for a rank.`,
                '',
                `**Roblox Username**\n${robloxUsername}`,
                '',
                `**New Rank**\n${rankResult.roleName}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // ─── STEP 2: final confirmation ───────────────────────────────────
      await InteractionHelper.safeEditReply(interaction, {
        content: '✅ You have been ranked successfully.',
      });

      logger.info(`[Exchanges] ${interaction.user.tag} exchanged gamepass and got ranked to ${rankResult.roleName}`);

    } catch (error) {
      logger.error('Exchanges error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
