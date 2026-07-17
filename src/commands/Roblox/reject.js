import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFERS_PATH = join(__dirname, '../../../offers.json');

// ✅ SIN ALLOWED_ROLES - Cualquier miembro del servidor puede rechazar

function loadOffers() {
  if (!existsSync(OFFERS_PATH)) {
    writeFileSync(OFFERS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
}

function saveOffers(offers) {
  writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('reject')
    .setDescription('❌ Reject a pending rank offer')
    .addStringOption(option =>
      option.setName('offer_id')
        .setDescription('The offer ID')
        .setRequired(true)),

  async execute(interaction) {
    // ✅ SIN ALLOWED_ROLES - Cualquier miembro del servidor puede rechazar

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

      offer.status = 'rejected';
      saveOffers(offers);

      // ─── ENVIAR DM AL USUARIO ──────────────────────────────────────────

      try {
        const discordUser = await interaction.client.users.fetch(offer.discordId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Rank Offer Rejected')
          .setDescription(`Your rank offer has been **REJECTED**.`)
          .addFields(
            { name: '👤 Roblox User', value: offer.robloxUsername, inline: true },
            { name: '📊 Rank', value: offer.rank, inline: true },
            { name: '❌ Rejected by', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();
        await discordUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn(`[Reject] Could not DM user: ${dmError.message}`);
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ Offer for **${offer.robloxUsername}** (${offer.rank}) has been rejected.`,
      });

      logger.info(`[Reject] ${interaction.user.tag} rejected offer ${offerId}`);

    } catch (error) {
      logger.error('Reject error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};