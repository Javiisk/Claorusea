import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../utils/embedHelper.js';
import { logger } from '../utils/logger.js';
import { InteractionHelper } from '../utils/interactionHelper.js';

const GAME_ID = 90664126150507;
const UNIVERSE_ID = 6260374796; // Universe ID del juego (diferente al Place ID)

// Función para obtener el Universe ID desde el Place ID
async function getUniverseId() {
  const res = await fetch(
    `https://apis.roblox.com/universes/v1/places/${GAME_ID}/universe`
  );
  if (!res.ok) throw new Error('No se pudo obtener el Universe ID');
  const data = await res.json();
  return data.universeId;
}

// Información principal del juego
async function getGameInfo(universeId) {
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`
  );
  if (!res.ok) throw new Error('No se pudo obtener la info del juego');
  const data = await res.json();
  return data.data[0];
}

// Servidores activos
async function getServerCount(universeId) {
  const res = await fetch(
    `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100`
  );
  if (!res.ok) return { servers: 0, players: 0 };
  const data = await res.json();
  const servers = data.data ?? [];
  const totalPlayers = servers.reduce((sum, s) => sum + (s.playing ?? 0), 0);
  return { servers: servers.length, players: totalPlayers };
}

// Icono del juego (thumbnail)
async function getGameIcon(universeId) {
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.imageUrl ?? null;
}

// Votos del juego
async function getGameVotes(universeId) {
  const res = await fetch(
    `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`
  );
  if (!res.ok) return { upVotes: 0, downVotes: 0 };
  const data = await res.json();
  const votes = data.data?.[0] ?? {};
  return { upVotes: votes.upVotes ?? 0, downVotes: votes.downVotes ?? 0 };
}

export default {
  data: new SlashCommandBuilder()
    .setName('gameinfo')
    .setDescription('Muestra la información del juego de Roblox del grupo.')
    .setDMPermission(false),

  async execute(interaction) {
    await InteractionHelper.safeDefer(interaction);

    try {
      // Obtener Universe ID dinámicamente (o usar el hardcodeado arriba)
      let universeId;
      try {
        universeId = await getUniverseId();
      } catch {
        universeId = UNIVERSE_ID; // fallback al hardcodeado
      }

      // Llamadas en paralelo para mayor velocidad
      const [gameInfo, serverData, iconUrl, votes] = await Promise.all([
        getGameInfo(universeId),
        getServerCount(universeId),
        getGameIcon(universeId),
        getGameVotes(universeId),
      ]);

      // Estado del juego
      const isPlayable = gameInfo.isPlayable;
      const statusText = isPlayable ? '🟢 Abierto' : '🔴 Cerrado';

      // Visitas formateadas
      const visits = gameInfo.visits?.toLocaleString('en-US') ?? '0';
      const favoritedCount = gameInfo.favoritedCount?.toLocaleString('en-US') ?? '0';
      const maxPlayers = gameInfo.maxPlayers ?? 0;

      // Descripción (limitar a 200 caracteres)
      const rawDesc = gameInfo.description?.trim() ?? 'Sin descripción.';
      const description = rawDesc.length > 200
        ? rawDesc.substring(0, 197) + '...'
        : rawDesc;

      // Porcentaje de likes
      const totalVotes = votes.upVotes + votes.downVotes;
      const likePercent = totalVotes > 0
        ? Math.round((votes.upVotes / totalVotes) * 100)
        : 0;

      // Fecha de creación y actualización
      const createdAt = gameInfo.created
        ? `<t:${Math.floor(new Date(gameInfo.created).getTime() / 1000)}:D>`
        : 'Desconocido';
      const updatedAt = gameInfo.updated
        ? `<t:${Math.floor(new Date(gameInfo.updated).getTime() / 1000)}:R>`
        : 'Desconocido';

      const embed = createEmbed({
        title: `🎮 ${gameInfo.name}`,
        description: `> ${description}`,
        color: isPlayable ? 0x57f287 : 0xed4245, // verde si abierto, rojo si cerrado
        thumbnail: iconUrl ?? undefined,
        fields: [
          {
            name: '📊 Estado',
            value: statusText,
            inline: true,
          },
          {
            name: '👥 Jugadores activos',
            value: `**${gameInfo.playing?.toLocaleString('en-US') ?? '0'}** / ${maxPlayers} por server`,
            inline: true,
          },
          {
            name: '🖥️ Servidores activos',
            value: `**${serverData.servers}** servidores`,
            inline: true,
          },
          {
            name: '🏆 Visitas totales',
            value: `**${visits}**`,
            inline: true,
          },
          {
            name: '⭐ Favoritos',
            value: `**${favoritedCount}**`,
            inline: true,
          },
          {
            name: '👍 Likes',
            value: `**${likePercent}%** (${votes.upVotes.toLocaleString('en-US')} 👍 / ${votes.downVotes.toLocaleString('en-US')} 👎)`,
            inline: true,
          },
          {
            name: '📅 Creado',
            value: createdAt,
            inline: true,
          },
          {
            name: '🔄 Última actualización',
            value: updatedAt,
            inline: true,
          },
          {
            name: '🔗 Enlace',
            value: `[Ir al juego](https://www.roblox.com/games/${GAME_ID})`,
            inline: true,
          },
        ],
        footer: { text: `Universe ID: ${universeId} • Place ID: ${GAME_ID}` },
        timestamp: true,
      });

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error(`Error en /gameinfo: ${error.message}`);
      const errEmbed = createEmbed({
        title: '❌ Error',
        description: 'No se pudo obtener la información del juego. Intenta de nuevo más tarde.',
        color: 0xed4245,
      });
      await InteractionHelper.safeEditReply(interaction, { embeds: [errEmbed] });
    }
  },
};
