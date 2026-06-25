import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const PLACE_ID = '90664126150507';
const UNIVERSE_ID = '7906381869';

async function getGameInfo() {
  const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`);
  if (!res.ok) throw new Error(`Games API error: ${res.status}`);
  const data = await res.json();
  if (!data.data?.[0]) throw new Error('No game data returned');
  return data.data[0];
}

async function getGameIcon() {
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${UNIVERSE_ID}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.imageUrl ?? null;
}

async function getGameVotes() {
  const res = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${UNIVERSE_ID}`);
  if (!res.ok) return { upVotes: 0, downVotes: 0 };
  const data = await res.json();
  const votes = data.data?.[0] ?? {};
  return { upVotes: votes.upVotes ?? 0, downVotes: votes.downVotes ?? 0 };
}

async function getActiveServers() {
  const res = await fetch(
    `https://games.roblox.com/v1/games/${UNIVERSE_ID}/servers/Public?limit=100`
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
      logger.warn('Gameinfo interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'gameinfo',
      });
      return;
    }

    try {
      const [gameInfo, iconUrl, votes, activeServers] = await Promise.all([
        getGameInfo(),
        getGameIcon(),
        getGameVotes(),
        getActiveServers(),
      ]);

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
          { name: '📊 Status',         value: status,                                                                                                      inline: true },
          { name: '👥 Active Players', value: `**${playing}** / ${maxPlayers} per server`,                                                                 inline: true },
          { name: '🖥️ Active Servers', value: `**${activeServers}**`,                                                                                      inline: true },
          { name: '🏆 Total Visits',   value: `**${visits}**`,                                                                                             inline: true },
          { name: '⭐ Favorites',      value: `**${favorites}**`,                                                                                          inline: true },
          { name: '👍 Rating',         value: `**${likePercent}%** (${votes.upVotes.toLocaleString('en-US')} 👍 / ${votes.downVotes.toLocaleString('en-US')} 👎)`, inline: true },
          { name: '📅 Created',        value: createdAt,                                                                                                   inline: true },
          { name: '🔄 Last Updated',   value: updatedAt,                                                                                                   inline: true },
          { name: '🔗 Link',           value: `[Go to Game](https://www.roblox.com/games/${PLACE_ID})`,                                                    inline: true }
        )
        .setFooter({ text: `Universe ID: ${UNIVERSE_ID} • Place ID: ${PLACE_ID}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Gameinfo command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while fetching game info.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
