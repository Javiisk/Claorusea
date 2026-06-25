import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const PLACE_ID = '90664126150507';

async function getUniverseId() {
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${PLACE_ID}/universe`);
  if (!res.ok) throw new Error('Failed to fetch universe ID');
  const data = await res.json();
  return data.universeId;
}

async function getGameInfo(universeId) {
  const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!res.ok) throw new Error('Failed to fetch game info');
  const data = await res.json();
  return data.data?.[0] ?? null;
}

async function getGameIcon(universeId) {
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.imageUrl ?? null;
}

async function getGameVotes(universeId) {
  const res = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`);
  if (!res.ok) return { upVotes: 0, downVotes: 0 };
  const data = await res.json();
  const votes = data.data?.[0] ?? {};
  return { upVotes: votes.upVotes ?? 0, downVotes: votes.downVotes ?? 0 };
}

async function getActiveServers(universeId) {
  const res = await fetch(
    `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100`
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return data.data?.length ?? 0;
}

export default {
  data: new SlashCommandBuilder()
    .setName('gameinfo')
    .setDescription('Displays information about the Roblox game.')
    .setDMPermission(false),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Gameinfo interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'gameinfo' });
      return;
    }

    try {
      const universeId = await getUniverseId();

      const [gameInfo, iconUrl, votes, activeServers] = await Promise.all([
        getGameInfo(universeId),
        getGameIcon(universeId),
        getGameVotes(universeId),
        getActiveServers(universeId),
      ]);

      if (!gameInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not retrieve game information.',
        });
      }

      const isPlayable = gameInfo.isPlayable ?? false;
      const status = isPlayable ? '🟢 Open' : '🔴 Closed';

      const visits = gameInfo.visits?.toLocaleString('en-US') ?? '0';
      const favorites = gameInfo.favoritedCount?.toLocaleString('en-US') ?? '0';
      const playing = gameInfo.playing?.toLocaleString('en-US') ?? '0';
      const maxPlayers = gameInfo.maxPlayers ?? 0;

      const totalVotes = votes.upVotes + votes.downVotes;
      const likePercent = totalVotes > 0 ? Math.round((votes.upVotes / totalVotes) * 100) : 0;

      const rawDesc = gameInfo.description?.trim() ?? 'No description available.';
      const description = rawDesc.length > 200 ? rawDesc.substring(0, 197) + '...' : rawDesc;

      const createdAt = gameInfo.created
        ? `<t:${Math.floor(new Date(gameInfo.created).getTime() / 1000)}:D>`
        : 'Unknown';
      const updatedAt = gameInfo.updated
        ? `<t:${Math.floor(new Date(gameInfo.updated).getTime() / 1000)}:R>`
        : 'Unknown';

      const embed = createEmbed({ title: `🎮 ${gameInfo.name}`, description: null })
        .setDescription(`> ${description}`)
        .setColor(isPlayable ? 0x57f287 : 0xed4245)
        .setThumbnail(iconUrl ?? null)
        .addFields(
          { name: '📊 Status', value: status, inline: true },
          { name: '👥 Active Players', value: `**${playing}** / ${maxPlayers} per server`, inline: true },
          { name: '🖥️ Active Servers', value: `**${activeServers}**`, inline: true },
          { name: '🏆 Total Visits', value: `**${visits}**`, inline: true },
          { name: '⭐ Favorites', value: `**${favorites}**`, inline: true },
          { name: '👍 Rating', value: `**${likePercent}%** (${votes.upVotes.toLocaleString('en-US')} 👍 / ${votes.downVotes.toLocaleString('en-US')} 👎)`, inline: true },
          { name: '📅 Created', value: createdAt, inline: true },
          { name: '🔄 Last Updated', value: updatedAt, inline: true },
          { name: '🔗 Link', value: `[Go to Game](https://www.roblox.com/games/${PLACE_ID})`, inline: true }
        )
        .setFooter({ text: `Universe ID: ${universeId} • Place ID: ${PLACE_ID}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Gameinfo command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred while fetching game info.' });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
