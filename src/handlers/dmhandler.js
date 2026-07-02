import { EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../dm-log-config.json');

export default async function handleDM(message) {
  // Solo mensajes directos y que no sean del bot
  if (message.channel.type !== 1 || message.author.bot) return;

  const config = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : null;
  if (!config || !config.enabled || !config.channelId) return;

  try {
    const logChannel = await message.client.channels.fetch(config.channelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📩 DM Received')
      .setDescription(message.content || '*No text content*')
      .addFields(
        { name: 'User ID', value: message.author.id, inline: true },
        { name: 'Username', value: message.author.tag, inline: true },
        { name: 'User Ping', value: `<@${message.author.id}>`, inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
    logger.info(`[DM Log] Logged DM from ${message.author.tag}`);
  } catch (error) {
    logger.error('[DM Log] Error logging DM:', error);
  }
}
