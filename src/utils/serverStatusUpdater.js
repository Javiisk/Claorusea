// src/utils/serverStatusUpdater.js
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';
import { logger } from './logger.js';
import { activeServers } from './serverStatusDB.js'; // ✅ Ruta corregida

const CHANNEL_ID = '1546992108160679986';
const MESSAGE_ID = '1562932998004023328';

export function startServerStatusUpdater(client) {
  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(MESSAGE_ID).catch(() => null);
      if (!message) return;

      let lines = [];
      lines.push('SERVERS INDICATED WITH A RED COLOUR OR A DASH (-) PRIOR TO THE SERVER NAME REQUIRE IMMEDIATE ASSISTANCE AND SHOULD BE PRIORITIZED\n');

      const servers = Array.from(activeServers.values());
      
      if (servers.length === 0) {
        lines.push('No active servers.');
      } else {
        servers.sort((a, b) => (b.campers - b.staff) - (a.campers - a.staff));

        servers.forEach((srv, i) => {
          const needsHelp = srv.campers > srv.staff;
          const indicator = needsHelp ? '-' : '✓'; 
          const serverName = `Server ${i + 1}`; 
          lines.push(`${indicator} ${serverName} | Staff: ${srv.staff} | Campers: ${srv.campers}`);
        });
      }

      const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
      lines.push(`\nLast Update: ${timeStr} GMT`);
      lines.push(`Service hosted by Vexliato`);

      const container = new ContainerBuilder()
        .setAccentColor(null)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('SERVER LISTS')
        )
        .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        );

      await message.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (err) {
      logger.error('[ServerStatusUpdater] Error:', err.message);
    }
  }, 60000); // Cada minuto
}