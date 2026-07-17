import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';
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
  'Guest', 'Losted Denizen', 'Denizen', 'Inhabitant',
  'Irregular Inhabitant', 'Luminous Inhabitant', 'Abandoned',
  'Untrained Encamp', 'Camp Volunteer', 'Camp Activist',
  'Camp Aspirant', 'Camp Counselor', 'Camp Shepherd',
  'Chalet Associate', 'Chalet Advocate', 'Chalet Chaperon',
  'Chalet Cultivator', 'Quarter Delegate', 'Regnant Council',
  'Regnant Evaluator', 'Regnant Regulator', 'Cabin Artisan',
  'Cabin Meister', 'Directorial Superior', 'Directorial Confederate',
  "Supreme's Architect", "Genesia's Prescient", 'Genesia', 'Supreme'
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
    .addUserOption(option =>
      option.setName('discorduser')
        .setDescription('Discord user to offer the rank to')
        .setRequired(true)
    )
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
      const discordUser = interaction.options.getUser('discorduser');
      const rank = interaction.options.getString('rank');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      // ─── OBTENER INFO DE ROBLOX VIA BLOXLINK ──────────────────────────

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      // ─── GUARDAR OFERTA ────────────────────────────────────────────────

      const offerId = generateOfferId();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      const offers = loadOffers();
      offers[offerId] = {
        robloxId: robloxId,
        robloxUsername: robloxUsername,
        discordId: discordUser.id,
        discordTag: discordUser.tag,
        rank: rank,
        reason: reason,
        offeredBy: interaction.user.id,
        offeredByTag: interaction.user.tag,
        expiresAt: expiresAt,
        status: 'pending',
        createdAt: Date.now(),
      };
      saveOffers(offers);

      // ─── CREAR EMBED ────────────────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🎯 Rank Offer Created')
        .setDescription(`A rank offer has been created for **${robloxUsername}**!`)
        .addFields(
          { name: '👤 Roblox User', value: robloxUsername, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
          { name: '📊 Rank', value: rank, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '📋 Offer ID', value: `\`${offerId}\``, inline: false },
          { name: '⏳ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: false },
          { name: '👤 Offered by', value: `${interaction.user.tag}`, inline: false },
          { name: '\u200B', value: `**To accept:** \`/accept ${offerId}\`\n**To reject:** \`/reject ${offerId}\``, inline: false }
        )
        .setTimestamp();

      // ─── ENVIAR AL CANAL DE LOGS ──────────────────────────────────────

      const logChannelId = '1504301603262566440';
      const logChannel = await interaction.client.channels.fetch(logChannelId);
      if (logChannel) {
        await logChannel.send({
          content: `<@&1513330537798959135>`,
          embeds: [embed],
        });
      }

      // ─── ENVIAR DM AL USUARIO ──────────────────────────────────────────

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('🎯 Rank Offer Received')
          .setDescription(`You have received a rank offer from **${interaction.user.tag}**!`)
          .addFields(
            { name: '👤 Roblox User', value: robloxUsername, inline: true },
            { name: '📊 Rank', value: rank, inline: true },
            { name: '📝 Reason', value: reason, inline: false },
            { name: '⏳ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: false },
            { name: '📋 Offer ID', value: `\`${offerId}\``, inline: false },
            { name: '\u200B', value: `**To accept:** \`/accept ${offerId}\`\n**To reject:** \`/reject ${offerId}\``, inline: false }
          )
          .setTimestamp();

        await discordUser.send({ embeds: [dmEmbed] });
        logger.info(`[Offer] DM sent to ${discordUser.tag}`);
      } catch (dmError) {
        logger.warn(`[Offer] Could not DM ${discordUser.tag}: ${dmError.message}`);
      }

      // ─── RESPUESTA AL STAFF ────────────────────────────────────────────

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Offer created!\n📋 ID: \`${offerId}\`\n👤 User: ${robloxUsername}\n📊 Rank: ${rank}\n📨 DM sent to <@${discordUser.id}>\n⏳ Expires in 24 hours.\n\n📌 Accept: \`/accept ${offerId}\`\n📌 Reject: \`/reject ${offerId}\``,
      });

      logger.info(`[Offer] ${interaction.user.tag} offered ${rank} to ${robloxUsername}`);

    } catch (error) {
      logger.error('Offer error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};