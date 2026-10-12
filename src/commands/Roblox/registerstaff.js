// src/commands/Roblox/registerstaff.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import {
  getRobloxUserByDiscord,
  getRobloxUsernameById,
  getRobloxGroupRank,
} from '../../utils/bloxlink.js';
import { registerStaff, getStaff } from '../../utils/staffStorage.js';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;

export default {
  data: new SlashCommandBuilder()
    .setName('registerstaff')
    .setDescription('Register a staff member in the database and Trello.')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to register')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('roblox_username')
        .setDescription('Roblox username (if not linked via Bloxlink)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const manualUsername = interaction.options.getString('roblox_username');

    // ─── Already registered? ────────────────────────────────────────────
    const existing = await getStaff(target.id);
    if (existing) {
      return interaction.editReply({
        content: `⚠️ <@${target.id}> is already registered as staff. Rank: **${existing.rank || 'N/A'}**.`,
      });
    }

    // ─── Resolve Roblox data ────────────────────────────────────────────
    let robloxId = null;
    let robloxUsername = manualUsername || null;
    let robloxRank = 'N/A';

    try {
      const bloxlink = await getRobloxUserByDiscord(target.id);
      if (bloxlink?.robloxID) {
        robloxId = bloxlink.robloxID;
        if (!robloxUsername) {
          robloxUsername = await getRobloxUsernameById(robloxId);
        }
        const rank = await getRobloxGroupRank(robloxId);
        if (rank && rank !== 'Error fetching rank' && rank !== 'Not in the group') {
          robloxRank = rank;
        }
      }
    } catch (err) {
      console.warn('[RegisterStaff] Bloxlink lookup failed:', err.message);
    }

    if (!robloxUsername) {
      return interaction.editReply({
        content: `❌ Could not resolve Roblox username for <@${target.id}>. They need to link via Bloxlink or you must provide \`roblox_username\`.`,
      });
    }

    // ─── Save to DB ────────────────────────────────────────────────────
    const staffRecord = {
      discordId: target.id,
      robloxId,
      robloxUsername,
      rank: robloxRank,
      registeredBy: interaction.user.id,
      registeredAt: Date.now(),
    };

    await registerStaff(target.id, staffRecord);

    // ─── Create Trello card ────────────────────────────────────────────
    let trelloCardUrl = null;
    if (TRELLO_API_KEY && TRELLO_TOKEN && TRELLO_LIST_ID) {
      try {
        const cardName = `${robloxUsername} (${target.username})`;
        const cardDesc =
          `**Discord:** <@${target.id}> (\`${target.tag}\`)\n` +
          `**Roblox ID:** ${robloxId || 'N/A'}\n` +
          `**Roblox Username:** ${robloxUsername}\n` +
          `**Roblox Rank:** ${robloxRank}\n` +
          `**Registered by:** ${interaction.user.tag}\n` +
          `**Registered at:** <t:${Math.floor(Date.now() / 1000)}:F>`;

        const res = await fetch(
          `https://api.trello.com/1/cards?idList=${TRELLO_LIST_ID}&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cardName, desc: cardDesc }),
          }
        );

        if (res.ok) {
          const card = await res.json();
          trelloCardUrl = card.shortUrl;
          // Save Trello card ID for future updates
          await registerStaff(target.id, { ...staffRecord, trelloCardId: card.id, trelloCardUrl });
        } else {
          console.error('[RegisterStaff] Trello error:', await res.text());
        }
      } catch (err) {
        console.error('[RegisterStaff] Trello request failed:', err.message);
      }
    } else {
      console.warn('[RegisterStaff] Trello credentials missing, skipping card creation.');
    }

    // ─── Confirmation ──────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📋 Staff Registered')
      .addFields(
        { name: 'Discord', value: `<@${target.id}>`, inline: true },
        { name: 'Roblox', value: robloxUsername, inline: true },
        { name: 'Roblox Rank', value: robloxRank, inline: true },
        {
          name: 'Trello Card',
          value: trelloCardUrl ? `[View card](${trelloCardUrl})` : '❌ Not created',
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};