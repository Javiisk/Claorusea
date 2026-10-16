// src/web/sendContainer.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { isAuthorized } from './auth.js';

export function registerSendContainerRoute(app, client) {
  app.post('/api/send-container', async (req, res) => {
    const { token, channelId, payload } = req.body;

    if (!isAuthorized(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!channelId || !payload) {
      return res.status(400).json({ error: 'Missing channelId or payload' });
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const container = new ContainerBuilder();
      container.setAccentColor(payload.accent_color ?? null);

      for (const comp of payload.components || []) {
        if (comp.type === 17) {
          for (const inner of comp.components || []) {
            addComponent(container, inner);
          }
        } else {
          addComponent(container, comp);
        }
      }

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      logger.info(`[SendContainer] Sent to ${channelId}`);
      res.json({ ok: true });
    } catch (err) {
      logger.error('[SendContainer] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

function addComponent(container, comp) {
  switch (comp.type) {
    case 10:
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(comp.content || '')
      );
      break;

    case 14: {
      const spacing = comp.spacing === 2
        ? SeparatorSpacingSize.Large
        : SeparatorSpacingSize.Small;
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(spacing)
      );
      break;
    }

    case 12: {
      const gallery = new MediaGalleryBuilder();
      for (const item of comp.items || []) {
        if (item.media?.url) {
          gallery.addItems(
            new MediaGalleryItemBuilder().setURL(item.media.url)
          );
        }
      }
      container.addMediaGalleryComponents(gallery);
      break;
    }

    case 1: {
      const row = new ActionRowBuilder();
      for (const btn of comp.components || []) {
        if (btn.type === 2) {
          const builder = new ButtonBuilder()
            .setLabel(btn.label || 'Button')
            .setStyle(mapButtonStyle(btn.style));
          if (btn.style === 5 && btn.url) builder.setURL(btn.url);
          row.addComponents(builder);
        }
      }
      container.addActionRowComponents(row);
      break;
    }

    default:
      logger.warn(`[SendContainer] Unknown component type: ${comp.type}`);
  }
}

function mapButtonStyle(style) {
  switch (style) {
    case 1: return ButtonStyle.Primary;
    case 2: return ButtonStyle.Secondary;
    case 3: return ButtonStyle.Success;
    case 4: return ButtonStyle.Danger;
    case 5: return ButtonStyle.Link;
    default: return ButtonStyle.Secondary;
  }
}