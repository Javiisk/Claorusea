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

const RANK_NAMES = [
  'Guest', 'Denizen', 'Esteemed Denizen', 'Agressive Denizen',
  'Honored Denizen', 'Untrained Encamp', 'Camp Volunteer',
  'Camp Activist', 'Camp Counselour', 'Camp Coordinator',
  'Camp Supervisor', 'Camp Council', 'Domain Superior',
  'Domain Delegate', 'Domain Confidant', 'Domain Regent'
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

function generateOfferId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export default {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('🎯 Offer a rank to a user (24h expiry)')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('Roblox username')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('discorduser')
        .setDescription('Discord user to notify')
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
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const user = interaction.options.getString('user');
      const discordUser = interaction.options.getUser('discorduser');
      const rank = interaction.options.getString('rank');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const offerId = generateOfferId();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      // Guardar oferta
      const offers = loadOffers();
      offers[offerId] = {
        user: user,
        discordId: discordUser.id,
        rank: rank,
        reason: reason,
        offeredBy: interaction.user.id,
        offeredByTag: interaction.user.tag,
        expiresAt: expiresAt,
        status: 'pending',
        createdAt: Date.now(),
      };
      saveOffers(offers);

      // ─── ENVIAR DM AL USUARIO ──────────────────────────────────────────

      try {
        const dmEmbed = {
          title: '🎯 Rank Offer Received',
          color: 0xF1C40F,
          description: `You have received a rank offer from **${interaction.user.tag}**!`,
          fields: [
            { name: '👤 Roblox User', value: user, inline: true },
            { name: '📊 Rank', value: rank, inline: true },
            { name: '📝 Reason', value: reason, inline: false },
            { name: '⏳ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: false },
            { name: '📋 Offer ID', value: `\`${offerId}\``, inline: false },
            { name: '\u200B', value: `To accept: \`/accept ${offerId}\`\nTo reject: \`/reject ${offerId}\``, inline: false },
          ],
          timestamp: new Date().toISOString(),
        };

        await discordUser.send({ embeds: [dmEmbed] });
        logger.info(`[Offer] DM sent to ${discordUser.tag}`);
      } catch (dmError) {
        logger.warn(`[Offer] Could not DM ${discordUser.tag}: ${dmError.message}`);
        // No falla el comando si no se puede enviar DM
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Offer created!\n📋 ID: \`${offerId}\`\n👤 User: ${user}\n📊 Rank: ${rank}\n📨 DM sent to <@${discordUser.id}>\n⏳ Expires in 24 hours.\n\n📌 Accept: \`/accept ${offerId}\`\n📌 Reject: \`/reject ${offerId}\``,
      });

      logger.info(`[Offer] ${interaction.user.tag} offered ${rank} to ${user}`);

    } catch (error) {
      logger.error('Offer error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};
