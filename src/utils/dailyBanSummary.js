// src/utils/dailyBanSummary.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { logger } from './logger.js';
import { getFromDb, setInDb } from './database.js';

const AUTOBAN_CHANNEL_ID = '1560388916018683965';
const AUTOBAN_ALERT_KEY = 'autoban:alert:message_id';

export async function startDailyBanSummary(client) {
  try {
    const channel = await client.channels.fetch(AUTOBAN_CHANNEL_ID).catch(() => null);
    if (!channel) {
      logger.warn('[DailyBanSummary] Channel not found');
      return;
    }

    // ─── Check if container already exists ─────────────────────────────
    const existingId = await getFromDb(AUTOBAN_ALERT_KEY, null);
    if (existingId) {
      const existingMsg = await channel.messages.fetch(existingId).catch(() => null);
      if (existingMsg) {
        logger.info('[DailyBanSummary] Container already exists, skipping.');
        return;
      }
      logger.warn('[DailyBanSummary] Stored message not found, sending a new one.');
    }

    // ─── Send the Container V2 ─────────────────────────────────────────
    const container = new ContainerBuilder()
      .setAccentColor(0xED4245)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 🔨 Do not post here')
      )
      .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `This channel is used to remove bots and compromised accounts. ` +
          `Posting anything in this channel will automatically remove you from the server.`
        )
      )
      .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Appeal a moderation')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/ajWYjRrTD5')
        )
      );

    const sent = await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    // ─── Save message ID so we don't duplicate on restart ──────────────
    await setInDb(AUTOBAN_ALERT_KEY, sent.id);

    logger.info(`[DailyBanSummary] Container V2 sent (id: ${sent.id})`);
  } catch (err) {
    logger.error('[DailyBanSummary] Failed:', err.message);
  }
}