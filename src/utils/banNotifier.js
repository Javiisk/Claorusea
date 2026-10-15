// src/utils/banNotifier.js
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

const APPEAL_URL = 'https://discord.gg/ajWYjRrTD5';

export async function sendBanDM(user) {
  try {
    const dm = await user.createDM();

    const container = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '<:mod:1560395646626697317> **Automod Message**'
        )
      )
      .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `You have been banned from **Adoresa** for talking on autoban channel! ` +
          `If you recovered your account, feel free to appeal your ban here.`
        )
      )
      .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Issued:\n<t:${Math.floor(Date.now() / 1000)}:F>`
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Appeal')
            .setStyle(ButtonStyle.Link)
            .setURL(APPEAL_URL)
        )
      );

    await dm.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    logger.warn(`[BanNotifier] Could not DM ${user.tag}: ${err.message}`);
  }
}