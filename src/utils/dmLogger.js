// src/handlers/dmLogger.js

import { EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../dm-log-config.json');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return { enabled: false, channelId: null };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { enabled: false, channelId: null };
  }
}

export async function handleDM(client, message) {
  // Solo DMs de usuarios (no bots)
  if (message.author.bot) return;
  if (message.guildId) return;

  const config = loadConfig();
  
  // Si no está habilitado, no hacer nada
  if (!config.enabled || !config.channelId) return;

  try {
    const logChannel = await client.channels.fetch(config.channelId);
    if (!logChannel) return;

    // Obtener información del usuario
    const user = message.author;
    
    // Determinar el tipo de contenido
    let content = message.content || '📎 **Archivo adjunto**';
    let attachments = [];
    
    if (message.attachments.size > 0) {
      attachments = message.attachments.map(a => a.url).join('\n');
    }

    // Crear embed
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📩 DM Received')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Usuario', value: `${user.tag} (${user.id})`, inline: false },
        { name: '📝 Mensaje', value: content.length > 1024 ? content.slice(0, 1021) + '...' : content, inline: false }
      )
      .setTimestamp(message.createdAt)
      .setFooter({ text: `User ID: ${user.id}` });

    // Si hay attachments
    if (attachments) {
      embed.addFields({ name: '📎 Adjuntos', value: attachments, inline: false });
    }

    // Enviar al canal de logs
    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    logger.error('DM Logger error:', error);
  }
}