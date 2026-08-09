// src/utils/dmLogger.js

import { EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

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
  // Only DMs from users (not bots)
  if (message.author.bot) return;
  if (message.guildId) return;

  const config = loadConfig();
  
  // If not enabled, do nothing
  if (!config.enabled || !config.channelId) return;

  try {
    const logChannel = await client.channels.fetch(config.channelId);
    if (!logChannel) return;

    const user = message.author;
    let content = message.content || '📎 **Attachment**';
    let attachments = [];
    
    if (message.attachments.size > 0) {
      attachments = message.attachments.map(a => a.url).join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📩 DM Received')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: false },
        { name: '📝 Message', value: content.length > 1024 ? content.slice(0, 1021) + '...' : content, inline: false }
      )
      .setTimestamp(message.createdAt)
      .setFooter({ text: `User ID: ${user.id}` });

    if (attachments) {
      embed.addFields({ name: '📎 Attachments', value: attachments, inline: false });
    }

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    logger.error('DM Logger error:', error);
  }
}