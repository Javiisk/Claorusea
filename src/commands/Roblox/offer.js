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

// ─── RANGOS DE TU GRUPO ────────────────────────────────────────────────────

const RANK_IDS = {
  // Visitantes
  'Guest': 0,
  
  // Denizen (Rangos 1-4)
  'Losted Denizen': 1,
  'Denizen': 1,
  'Esteemed Denizen': 2,
  'Agressive Denizen': 3,
  'Honored Denizen': 4,
  
  // Camp (Rangos 7-13)
  'Untrained Encamp': 7,
  'Camp Volunteer': 8,
  'Camp Activist': 9,
  'Camp Counselour': 10,
  'Camp Coordinator': 11,
  'Camp Supervisor': 12,
  'Camp Council': 13,
  
  // Library/Church (Rangos 14-18)
  'Library Coordinator': 14,
  'Church Advisor': 15,
  'Camp Chaplain': 16,
  'Camp Strategist': 17,
  'Camp Counsultant': 18,
  
  // Domain (Rangos 20-23)
  'Domain Superior': 20,
  'Domain Delegate': 21,
  'Domain Confidant': 22,
  'Domain Regent': 23,
  
  // Quaestor (Rangos 25-34)
  'Quaestor Design': 25,
  'Quaestor Artisan': 26,
  'Quaestor Contractor': 27,
  'Quaestor Craftman': 28,
  'Quaestor Surgeon': 29,
  'Quaestor Carer': 30,
  'Quaestor Prator': 31,
  'Quaestor Legate': 32,
  'Quaestor Sovereign': 33,
  'Quaestor Visionary': 34,
  
  // Rangos especiales
  'The Human': 243,
  'The Secretary': 254,
  'The Supreme': 255,
};

// ─── Nombres de rangos para el autocomplete ──────────────────────────────

const RANK_NAMES = Object.keys(RANK_IDS);

const LOG_CHANNEL_ID = '1504301603262566440';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

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

// ─── Comando ────────────────────────────────────────────────────────────────

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

      const robloxUser = await getRobloxUser(robloxUsername);
      if (!robloxUser) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

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
        robloxId: robloxUser.id,
        robloxUsername: robloxUser.name,
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

      const logEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🎯 New Rank Offer')
        .setDescription(`A rank offer has been created for **${robloxUser.name}**`)
        .addFields(
          { name: '👤 User', value: robloxUser.name, inline: true },
          { name: '🆔 Roblox ID', value: String(robloxUser.id), inline: true },
          { name: '📊 Rank', value: rankName, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '⏳ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: false },
          { name: '📋 Offer ID', value: `\`${offerId}\``, inline: false },
          { name: '📌 To accept', value: `/accept ${offerId}`, inline: true },
          { name: '📌 To reject', value: `/reject ${offerId}`, inline: true },
        )
        .setFooter({ text: `Offered by ${interaction.user.tag}` })
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send({ embeds: [logEmbed] });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Rank offer for **${robloxUser.name}** (${rankName}) created!\n📋 Offer ID: \`${offerId}\`\n⏳ Expires in 24 hours.`,
      });

      logger.info(`[Offer] ${interaction.user.tag} offered ${rankName} to ${robloxUser.name}`);

    } catch (error) {
      logger.error('Offer command error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred while creating the offer.',
        ephemeral: true,
      });
    }
  },
};
