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

const RANK_IDS = {
  'Guest': 0,
  'Losted Denizen': 1,
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
  'Library Coordinator': 14,
  'Church Advisor': 15,
  'Camp Chaplain': 16,
  'Camp Strategist': 17,
  'Camp Counsultant': 18,
  'Domain Superior': 20,
  'Domain Delegate': 21,
  'Domain Confidant': 22,
  'Domain Regent': 23,
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
  'The Human': 243,
  'The Secretary': 254,
  'The Supreme': 255,
};

const RANK_NAMES = Object.keys(RANK_IDS);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRobloxUser(username) {
  try {
    logger.info(`[DEBUG] Buscando usuario Roblox: ${username}`);
    
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    
    logger.info(`[DEBUG] Respuesta Roblox status: ${res.status}`);
    
    if (!res.ok) {
      logger.error(`[DEBUG] Error en Roblox API: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    logger.info(`[DEBUG] Datos Roblox: ${JSON.stringify(data)}`);
    
    return data.data?.[0] || null;
  } catch (error) {
    logger.error(`[DEBUG] Error en getRobloxUser: ${error.message}`);
    return null;
  }
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
      logger.info('[DEBUG] Iniciando comando /offer');
      
      const robloxUsername = interaction.options.getString('user');
      const rankName = interaction.options.getString('rank');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      logger.info(`[DEBUG] Username: ${robloxUsername}, Rank: ${rankName}`);

      // Verificar si el usuario existe en Roblox
      const robloxUser = await getRobloxUser(robloxUsername);
      
      if (!robloxUser) {
        logger.info('[DEBUG] Usuario no encontrado en Roblox');
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Roblox user **${robloxUsername}** not found.`,
        });
      }

      logger.info(`[DEBUG] Usuario encontrado: ${robloxUser.id} - ${robloxUser.name}`);

      const rankId = RANK_IDS[rankName];
      if (!rankId) {
        logger.info(`[DEBUG] Rango inválido: ${rankName}`);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ Invalid rank: **${rankName}**`,
        });
      }

      logger.info(`[DEBUG] Rank ID: ${rankId}`);

      const offerId = generateOfferId();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      logger.info(`[DEBUG] Offer ID: ${offerId}`);

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

      logger.info('[DEBUG] Oferta guardada correctamente');

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Rank offer for **${robloxUser.name}** (${rankName}) created!\n📋 Offer ID: \`${offerId}\`\n⏳ Expires in 24 hours.`,
      });

      logger.info(`[Offer] ${interaction.user.tag} offered ${rankName} to ${robloxUser.name}`);

    } catch (error) {
      logger.error(`[DEBUG] Error en /offer: ${error.message}`);
      logger.error(`[DEBUG] Stack: ${error.stack}`);
      await InteractionHelper.safeReply(interaction, {
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
