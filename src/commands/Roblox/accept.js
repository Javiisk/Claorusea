import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFERS_PATH = join(__dirname, '../../../offers.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const LOG_CHANNEL_ID = '1504301603262566440';

function loadOffers() {
  if (!existsSync(OFFERS_PATH)) {
    writeFileSync(OFFERS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
}

function saveOffers(offers) {
  writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2));
}

async function setRobloxRank(userId, rankId) {
  try {
    const groupId = process.env.ROBLOX_GROUP_ID;
    const apiKey = process.env.ROBLOX_API_KEY;
    const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ roleId: rankId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('✅ Accept a pending rank offer')
    .addStringOption(option =>
      option.setName('offer_id')
        .setDescription('The offer ID from the log embed')
        .setRequired(true)),

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

      const success = await setRobloxRank(offer.robloxId, offer.rankId);

      if (success) {
        offer.status = 'accepted';
        saveOffers(offers);

        const logEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Offer Accepted')
          .setDescription(`Rank offer for **${offer.robloxUsername}** was accepted`)
          .addFields(
            { name: '👤 User', value: offer.robloxUsername, inline: true },
            { name: '📊 Rank', value: offer.rankName, inline: true },
            { name: '✅ Accepted by', value: `<@${interaction.user.id}>`, inline: true },
          )
          .setTimestamp();

        const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ **${offer.robloxUsername}** has been promoted to **${offer.rankName}**!`,
        });

        logger.info(`[Accept] ${interaction.user.tag} accepted offer ${offerId} for ${offer.robloxUsername}`);
      } else {
        await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Failed to set rank for **${offer.robloxUsername}**. Check API key permissions.`,
        });
      }

    } catch (error) {
      logger.error('Accept command error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};
