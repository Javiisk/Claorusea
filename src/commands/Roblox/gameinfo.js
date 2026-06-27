import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GAME_ID = process.env.ROBLOX_GAME_ID || '90664126150507';

async function getGameInfo() {
  try {
    // Obtener información del juego (jugadores, estado)
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${GAME_ID}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.data?.[0] || null;
  } catch (error) {
    logger.error(`[GameInfo] Error: ${error.message}`);
    return null;
  }
}

async function getGameServers() {
  try {
    // Obtener servidores activos del juego
    const res = await fetch(`https://games.roblox.com/v1/games/${GAME_ID}/servers/Public?limit=100`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    logger.error(`[GameInfo] Error getting servers: ${error.message}`);
    return [];
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('gameinfo')
    .setDescription('Get information about the Roblox game')
    .setDMPermission(true),

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction, { ephemeral: false });

    try {
      const [gameInfo, servers] = await Promise.all([
        getGameInfo(),
        getGameServers(),
      ]);

      if (!gameInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not fetch game info. Please check the game ID.',
        });
      }

      // Calcular estadísticas de servidores
      const totalPlayers = servers.reduce((sum, s) => sum + (s.playing || 0), 0);
      const totalServers = servers.length;
      const emptyServers = servers.filter(s => s.playing === 0).length;
      const fullServers = servers.filter(s => s.playing >= s.maxPlayers - 1).length;

      // Obtener el número de jugadores actual desde la API principal
      const playingCount = gameInfo.playing || 0;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎮 ${gameInfo.name || 'Roblox Game'}`)
        .setDescription(gameInfo.description || 'No description available.')
        .setThumbnail(gameInfo.thumbnail?.[0]?.imageUrl || null)
        .addFields(
          { name: '🟢 Online Players', value: `\`${playingCount}\``, inline: true },
          { name: '📊 Total Servers', value: `\`${totalServers}\``, inline: true },
          { name: '🟡 Empty Servers', value: `\`${emptyServers}\``, inline: true },
          { name: '🔴 Full Servers', value: `\`${fullServers}\``, inline: true },
          { name: '👥 Max Players', value: `\`${gameInfo.maxPlayers || 'N/A'}\``, inline: true },
          { name: '📅 Created', value: gameInfo.created ? `<t:${Math.floor(new Date(gameInfo.created).getTime() / 1000)}:R>` : 'N/A', inline: true },
          { name: '🔗 Link', value: `[Play Game](https://www.roblox.com/games/${GAME_ID})`, inline: false }
        )
        .setFooter({ text: `Game ID: ${GAME_ID} • Updated: ${new Date().toLocaleTimeString()}` })
        .setTimestamp();

      // Servidores activos (top 5)
      const activeServers = servers
        .filter(s => s.playing > 0)
        .sort((a, b) => b.playing - a.playing)
        .slice(0, 5);

      if (activeServers.length > 0) {
        const serverList = activeServers.map((s, i) =>
          `**${i + 1}.** ${s.playing}/${s.maxPlayers} players (${s.id.substring(0, 8)}...)`
        ).join('\n');
        embed.addFields({
          name: '🖥️ Active Servers',
          value: serverList || 'No active servers',
          inline: false,
        });
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('GameInfo error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred while fetching game info.',
        ephemeral: true,
      });
    }
  },
};