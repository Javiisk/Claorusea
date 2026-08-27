import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserByDiscord } from '../../utils/bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYTIME_PATH = join(__dirname, '../../../playtime-data.json');

// ─── FUNCIONES DE BASE DE DATOS ──────────────────────────────────────────

function loadPlaytime() {
  if (!existsSync(PLAYTIME_PATH)) {
    writeFileSync(PLAYTIME_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(PLAYTIME_PATH, 'utf8'));
}

function savePlaytime(data) {
  writeFileSync(PLAYTIME_PATH, JSON.stringify(data, null, 2));
}

/**
 * Obtener el timestamp del próximo domingo a las 00:00
 */
function getNextSundayReset() {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo, 1 = lunes, ...
  
  // Si es domingo y ya pasaron las 00:00, el próximo es en 7 días
  // Si es domingo antes de las 00:00, es hoy a las 00:00
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);
  
  // Si es domingo pero ya pasó la medianoche, sumar 7 días
  if (day === 0 && now.getHours() >= 0 && now.getMinutes() >= 0) {
    // Solo si es domingo y la hora actual es después de las 00:00
    if (now.getHours() > 0 || now.getMinutes() > 0) {
      nextSunday.setDate(now.getDate() + 7);
    }
  }
  
  return nextSunday.getTime();
}

/**
 * Obtener la semana actual (número de semana desde el domingo)
 */
function getCurrentWeekId() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diff = now - startOfYear;
  const oneDay = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor(diff / oneDay);
  // Ajustar para que domingo sea el día 0 de la semana
  const dayOfWeek = now.getDay();
  return Math.floor((dayOfYear + dayOfWeek) / 7);
}

function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function getDiscordUserPlaytime(discordId) {
  const data = loadPlaytime();
  const weekId = getCurrentWeekId();
  
  if (!data[discordId]) {
    data[discordId] = { weekly: {} };
    savePlaytime(data);
  }
  
  if (!data[discordId].weekly[weekId]) {
    data[discordId].weekly[weekId] = { totalSeconds: 0, lastUpdated: null };
    savePlaytime(data);
  }
  
  return data[discordId].weekly[weekId];
}

function addPlaytime(discordId, seconds) {
  const data = loadPlaytime();
  const weekId = getCurrentWeekId();
  
  if (!data[discordId]) {
    data[discordId] = { weekly: {} };
  }
  
  if (!data[discordId].weekly[weekId]) {
    data[discordId].weekly[weekId] = { totalSeconds: 0, lastUpdated: null };
  }
  
  data[discordId].weekly[weekId].totalSeconds += seconds;
  data[discordId].weekly[weekId].lastUpdated = new Date().toISOString();
  savePlaytime(data);
  
  return data[discordId].weekly[weekId].totalSeconds;
}

function resetAllPlaytime() {
  const data = loadPlaytime();
  const weekId = getCurrentWeekId();
  
  // Limpiar todas las semanas anteriores
  for (const userId in data) {
    for (const wk in data[userId].weekly) {
      if (parseInt(wk) !== weekId) {
        delete data[userId].weekly[wk];
      }
    }
  }
  savePlaytime(data);
}

// ─── CHECKER DE REINICIO ──────────────────────────────────────────────────

let resetInitialized = false;

function startResetChecker() {
  if (resetInitialized) return;
  resetInitialized = true;

  // Verificar cada hora si hay que reiniciar
  setInterval(() => {
    const nextReset = getNextSundayReset();
    const now = Date.now();
    
    // Si ya pasó el próximo reset, ejecutar
    if (now >= nextReset) {
      logger.info('[Playtime] 🕐 Resetting weekly playtime...');
      resetAllPlaytime();
    }
  }, 60 * 60 * 1000); // Cada hora

  // Ejecutar una vez al inicio
  setTimeout(() => {
    const nextReset = getNextSundayReset();
    const now = Date.now();
    if (now >= nextReset) {
      logger.info('[Playtime] 🕐 Initial reset...');
      resetAllPlaytime();
    }
  }, 5000);

  logger.info('[Playtime] ✅ Auto-reset checker started');
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('mytime')
    .setDescription('🕐 Check your total playtime in the game')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add playtime to your account (staff only)')
        .addIntegerOption(opt =>
          opt.setName('minutes')
            .setDescription('Minutes to add')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1440)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View your total playtime')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // ─── INICIAR CHECKER ────────────────────────────────────────────────────

    startResetChecker();

    // ─── VIEW ──────────────────────────────────────────────────────────────

    if (subcommand === 'view') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const user = interaction.user;
        const playtime = getDiscordUserPlaytime(user.id);
        const formattedTime = formatTime(playtime.totalSeconds);

        // Obtener Roblox username
        let robloxName = 'Not linked';
        try {
          const bloxlinkData = await getRobloxUserByDiscord(user.id);
          if (bloxlinkData && bloxlinkData.primaryAccount) {
            robloxName = bloxlinkData.primaryAccount;
          }
        } catch {}

        // Calcular tiempo hasta el reset
        const nextReset = getNextSundayReset();
        const timeUntilReset = nextReset - Date.now();
        const daysLeft = Math.floor(timeUntilReset / (24 * 60 * 60 * 1000));
        const hoursLeft = Math.floor((timeUntilReset % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutesLeft = Math.floor((timeUntilReset % (60 * 60 * 1000)) / (60 * 1000));

        const resetText = daysLeft > 0 
          ? `${daysLeft}d ${hoursLeft}h ${minutesLeft}m`
          : `${hoursLeft}h ${minutesLeft}m`;

        const embed = new EmbedBuilder()
          .setColor(0x2F3136)
          .setDescription(`
### 🕐 ${user.username}'s Playtime

> <:AddIcon:1538060207396098130> **Discord:** ${user.tag}
> <:AddIcon:1538060207396098130> **Roblox:** ${robloxName}
> <:AddIcon:1538060207396098130> **Weekly Playtime:** **${formattedTime}**
> <:AddIcon:1538060207396098130> **Reset in:** ${resetText}

*Your playtime resets every Sunday at 12:00 AM*
          `)
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed],
          ephemeral: true,
        });

      } catch (error) {
        logger.error('MyTime view error:', error);
        try {
          await interaction.editReply({
            content: '❌ An error occurred while fetching your playtime.',
          });
        } catch (replyError) {
          logger.error('Failed to send error reply:', replyError);
        }
      }
    }

    // ─── ADD ──────────────────────────────────────────────────────────────

    if (subcommand === 'add') {
      const ALLOWED_ROLES = [
        '1505671292873867544',
        '1505671296883757158',
        '1505671309915328713',
        '1505673808097574912',
        '1505673879069393024',
      ];

      const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
      if (!hasRole) {
        return await interaction.reply({
          content: '❌ You don\'t have permission to use this command.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const minutes = interaction.options.getInteger('minutes');
        const seconds = minutes * 60;
        const user = interaction.user;

        const total = addPlaytime(user.id, seconds);
        const formattedTotal = formatTime(total);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`
### ✅ Playtime Added

> <:AddIcon:1538060207396098130> **Added:** ${minutes} minutes
> <:AddIcon:1538060207396098130> **New Total:** **${formattedTotal}**

*Playtime has been added to your account.*
          `)
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed],
          ephemeral: true,
        });

      } catch (error) {
        logger.error('MyTime add error:', error);
        try {
          await interaction.editReply({
            content: '❌ An error occurred while adding playtime.',
          });
        } catch (replyError) {
          logger.error('Failed to send error reply:', replyError);
        }
      }
    }
  },
};