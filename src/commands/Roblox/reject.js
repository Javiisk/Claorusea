import { SlashCommandBuilder } from 'discord.js';
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
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
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

      offer.status = 'rejected';
      saveOffers(offers);

      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ Offer for **${offer.user}** (${offer.rank}) has been rejected.`,
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
