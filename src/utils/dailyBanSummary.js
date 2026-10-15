// src/utils/dailyBanSummary.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from './logger.js';

const SUMMARY_CHANNEL_ID = '1560388916018683965';
const GMT_OFFSET = -6;

async function sendSummary(client) {
  try {
    const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID).catch(() => null);
    if (!channel) {
      logger.warn('[DailySummary] Channel not found');
      return;
    }

    const now = new Date();
    const gmt6 = new Date(now.getTime() + GMT_OFFSET * 60 * 60 * 1000);

    const dateStr = gmt6.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const timeStr = gmt6.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });

    const container = new ContainerBuilder()
      .setAccentColor(0x808080)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### 📊 Daily Summary')
      )
      .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Date:** ${dateStr}\n**Time:** ${timeStr} GMT-6`
        )
      );

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    logger.info('[DailySummary] Daily summary sent');
  } catch (err) {
    logger.error('[DailySummary] Failed:', err.message);
  }
}

function msUntilNextRun() {
  const now = new Date();
  const gmt6 = new Date(now.getTime() + GMT_OFFSET * 60 * 60 * 1000);

  const target = new Date(gmt6);
  target.setUTCHours(23, 59, 0, 0);
  if (target <= gmt6) target.setUTCDate(target.getUTCDate() + 1);

  return target.getTime() - gmt6.getTime();
}

let started = false;
export function startDailyBanSummary(client) {
  if (started) return;
  started = true;

  const scheduleNext = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      await sendSummary(client);
      scheduleNext();
    }, delay);
    logger.info(`[DailySummary] Next summary in ${Math.round(delay / 60000)} min`);
  };

  scheduleNext();
}