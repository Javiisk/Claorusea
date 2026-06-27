import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');
const GROUPS_PATH = join(__dirname, '../../../../blacklisted-groups.json');

const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;
const GUILD_ID = process.env.GUILD_ID;

const DEFAULT_GROUPS = [
  { id: '9221386', name: 'Unholy sacred sisters' },
  { id: '14029943', name: 'Empyreúm' },
  { id: '1097260506', name: 'Démoria' },
  { id: '97539052', name: 'Ivaloria' },
  { id: '35008390', name: 'la vélvoria' },
];

function loadGroups() {
  if (!existsSync(GROUPS_PATH)) {
    writeFileSync(GROUPS_PATH, JSON.stringify(DEFAULT_GROUPS, null, 2));
    return DEFAULT_GROUPS;
  }
  return JSON.parse(readFileSync(GROUPS_PATH, 'utf8'));
}

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function getUser(username) {
  const db = loadDB();
  const key = username.toLowerCase();
  if (!db[key]) db[key] = { username, trained: false, warnings: 0, blacklisted: false, blacklistReason: null };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return db[key];
}

function saveUser(username, data) {
  const db = loadDB();
  const key = username.toLowerCase();
  db[key] = { ...(db[key] || { username, trained: false, warnings: 0 }), ...data };
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function getRobloxUserByDiscord(discordId) {
  try {
    // Probar diferentes versiones de la API
    const urls = [
      `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`,
      `https://api.blox.link/v1/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`,
      `https://api.blox.link/v1/guilds/${GUILD_ID}/roblox-to-discord/${discordId}`,
    ];
    
    for (const url of urls) {
      logger.info(`[MyInfo] 📡 Probando URL: ${url}`);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': BLOXLINK_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      logger.info(`[MyInfo] 📥 Status: ${res.status}`);
      
      if (res.ok) {
        const data = await res.json();
        logger.info(`[MyInfo] ✅ Datos: ${JSON.stringify(data)}`);
        if (data && data.robloxId) {
          return data;
        }
        // Si la respuesta tiene "robloxId" pero es null, continuar
        if (data && data.robloxId === null) {
          logger.warn(`[MyInfo] ⚠️ Usuario no vinculado (robloxId null)`);
          return null;
        }
      } else if (res.status === 404) {
        // Intentar leer el error
        try {
          const errorText = await res.text();
          logger.warn(`[MyInfo] ⚠️ 404 - ${errorText}`);
        } catch {
          logger.warn(`[MyInfo] ⚠️ 404 - No se pudo leer el error`);
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`[MyInfo] ❌ Excepción: ${error.message}`);
    return null;
  }
}

async function getRobloxGroupRank(userId) {
  try {
    const groupId = process.env.ROBLOX_GROUP_ID;
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(groupId));
    return group ? group.role.name : 'Not in the group';
  } catch {
    return 'Error fetching rank';
  }
}

async function getRobloxAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function checkBlacklistedGroups(userId) {
  try {
    const blacklistedGroups = loadGroups();
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const userGroups = data.data?.map(g => String(g.group.id)) || [];
    const found = blacklistedGroups.find(g => userGroups.includes(g.id));
    return found || null;
  } catch {
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('View your Roblox profile and group status')
    .setDMPermission(true)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to look up (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('MyInfo interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId || 'DM',
        commandName: 'myinfo',
      });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      logger.info(`[MyInfo] 👤 Buscando: ${targetUser.tag} (${targetUser.id})`);

      if (!BLOXLINK_API_KEY || !GUILD_ID) {
        logger.error('[MyInfo] ❌ Faltan variables');
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Bloxlink no está configurado.',
        });
      }

      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);

      if (!bloxlinkData || !bloxlinkData.robloxId) {
        logger.warn(`[MyInfo] ⚠️ ${targetUser.tag} no vinculado`);
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** no tiene una cuenta de Roblox vinculada.\n\n🔹 **Solución:** Usa el comando \`/roblox link javii_090\` en el servidor.`,
        });
      }

      const robloxId = bloxlinkData.robloxId;
      const robloxUsername = bloxlinkData.primaryAccount || 'Unknown';

      logger.info(`[MyInfo] ✅ Roblox: ${robloxUsername} (${robloxId})`);

      const [rank, avatar, blacklistedGroup] = await Promise.all([
        getRobloxGroupRank(robloxId),
        getRobloxAvatar(robloxId),
        checkBlacklistedGroups(robloxId),
      ]);

      const userData = getUser(robloxUsername);

      if (blacklistedGroup && !userData.blacklisted) {
        saveUser(robloxUsername, {
          blacklisted: true,
          blacklistReason: `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`,
        });
        userData.blacklisted = true;
        userData.blacklistReason = `Member of blacklisted group: ${blacklistedGroup.name} (${blacklistedGroup.id})`;
      }

      const trainedText = userData.trained ? '✅ Trained' : '❌ Untrained';
      const warningsText = userData.warnings > 0 ? `⚠️ ${userData.warnings}` : 'None';
      const blacklistText = userData.blacklisted
        ? `🚫 ${userData.blacklistReason || 'No reason'}`
        : 'None';

      const embed = createEmbed({ title: `📋 ${robloxUsername}'s Profile`, description: null })
        .setThumbnail(avatar)
        .addFields(
          { name: '👤 Discord User', value: `${targetUser}`, inline: false },
          { name: '🆔 Roblox ID', value: String(robloxId), inline: false },
          { name: '📊 Rank', value: rank, inline: false },
          { name: '✅ Trained', value: trainedText, inline: false },
          { name: '⚠️ Warnings', value: warningsText, inline: false },
          { name: '🚫 Blacklists', value: blacklistText, inline: false },
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('MyInfo command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching the information.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
