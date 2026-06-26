import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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

// Rangos simplificados para pruebas
const RANK_IDS = {
  'Guest': 0,
  'Denizen': 1,
  'Esteemed Denizen': 2,
  'Agressive Denizen': 3,
  'Honored Denizen': 4,
  'Untrained Encamp': 7,
  'Camp Volunteer': 8,
  'Camp Activist': 9,
  'Camp Counselour': 10,
  'Camp Coordinator': 11,
  'Camp Supervisor': 12,
  'Camp Council': 13,
  'Domain Superior': 20,
  'Domain Delegate': 21,
  'Domain Confidant': 22,
  'Domain Regent': 23,
};

const RANK_NAMES = Object.keys(RANK_IDS);

function loadOffers() {
  if (!existsSync(OFFERS_PATH)) {
    writeFileSync(OFFERS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
}

function saveOffers(offers) {
  writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2));
}

function generateOfferId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export default {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('🎯 Offer a rank to a Roblox user (24h expiry)')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('Roblox username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Rank to offer')
        .setRequired(true)
        .addChoices(
          ...RANK_NAMES.map(name => ({ name, value: name }))
        ))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the offer')
        .setRequired(false)),

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
      const robloxUsername = interaction.options.getString('user');
      const rankName = interaction.options.getString('rank');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const rankId = RANK_IDS[rankName];
      if (!rankId) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Invalid rank: **${rankName}**`,
        });
      }

      const offerId = generateOfferId();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      const offers = loadOffers();
      offers[offerId] = {
        robloxUsername: robloxUsername,
        rankName: rankName,
        rankId: rankId,
        reason: reason,
        offeredBy: interaction.user.id,
        offeredByTag: interaction.user.tag,
        expiresAt: expiresAt,
        status: 'pending',
        createdAt: Date.now(),
      };
      saveOffers(offers);

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Rank offer for **${robloxUsername}** (${rankName}) created!\n📋 Offer ID: \`${offerId}\`\n⏳ Expires in 24 hours.`,
      });

      logger.info(`[Offer] ${interaction.user.tag} offered ${rankName} to ${robloxUsername}`);

    } catch (error) {
      logger.error('Offer command error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred while creating the offer.',
        ephemeral: true,
      });
    }
  },
};
