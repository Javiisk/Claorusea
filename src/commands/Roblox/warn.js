import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserByDiscord } from './bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../../../roblox-data.json');

function loadDB() {
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Add a warning to a user (Updates their MyInfo)')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The Discord user to warn')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (targetUser.id === interaction.user.id) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You cannot warn yourself.'
      });
    }

    try {
      const bloxlinkData = await getRobloxUserByDiscord(targetUser.id);
      
      if (!bloxlinkData || !bloxlinkData.robloxID) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked. Cannot add the warning.`,
        });
      }

      const robloxId = String(bloxlinkData.robloxID);
      const robloxUsername = bloxlinkData.primaryAccount || `User_${robloxId}`;

      // Cargar la base de datos usando el DISCORD ID como clave
      const db = loadDB();
      const key = targetUser.id; // <-- CAMBIO: Usamos el Discord ID

      if (!db[key]) {
        db[key] = { 
          discordId: targetUser.id,
          robloxId: robloxId,
          username: robloxUsername, 
          trained: false, 
          warnings: [], 
          blacklisted: false, 
          blacklistReason: null 
        };
      } else {
        // Asegurarnos de que el Roblox ID en el JSON coincida con el actual
        db[key].robloxId = robloxId;
        db[key].username = robloxUsername;
      }

      // Agregar la nueva advertencia al array
      const newWarn = {
        id: db[key].warnings.length + 1,
        reason: reason,
        moderator: interaction.user.tag,
        date: new Date().toISOString()
      };
      
      db[key].warnings.push(newWarn);
      saveDB(db);

      logger.info(`[Warn] ${targetUser.tag} (${robloxUsername}) warned. Total: ${db[key].warnings.length}. Reason: ${reason}`);

      // DM Notification
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ You have received a warning')
        .setDescription(`You have been warned in **${interaction.guild.name}**.`)
        .addFields(
          { name: '👮 Moderator', value: interaction.user.tag, inline: true },
          { name: '📋 Reason', value: reason, inline: false },
          { name: '📊 Total Warnings', value: `${db[key].warnings.length}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Warning System' });

      let dmError = false;
      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError_) {
        dmError = true;
        logger.warn(`[Warn] Could not send DM to ${targetUser.tag}. DMs are closed.`);
      }

      // Public Reply
      const successEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('✅ Warning Applied')
        .setDescription(`A warning has been added to **${targetUser.tag}**.`)
        .addFields(
          { name: 'Roblox User', value: robloxUsername, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Total Warnings', value: `${db[key].warnings.length}`, inline: true },
          { name: 'DM Notification', value: dmError ? '❌ Not sent (DMs closed)' : '✅ Sent successfully', inline: false }
        )
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [successEmbed] });

    } catch (error) {
      logger.error('Warn command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: '❌ An error occurred while executing the warning command.',
      });
    }
  },
};