import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('🖥️ Show all active servers in the game')
    .setDMPermission(true)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Server type')
        .setRequired(false)
        .addChoices(
          { name: 'All Servers', value: 'all' },
          { name: 'Public Servers', value: 'public' },
          { name: 'Private Servers', value: 'private' }
        )
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Servers defer failed', {
        userId: interaction.user.id,
        commandName: 'servers',
      });
      return;
    }

    try {
      const serverType = interaction.options.getString('type') || 'all';

      const url = `https://games.roblox.com/v1/games/${UNIVERSE_ID}/servers/Public?limit=100`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const servers = data.data || [];

      const gameUrl = `https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`;
      const gameRes = await fetch(gameUrl, {
        headers: { 'x-api-key': ROBLOX_API_KEY }
      });
      const gameData = await gameRes.json();
      const gameInfo = gameData.data?.[0] || null;

      if (!gameInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Could not fetch game information.',
        });
      }

      let filteredServers = servers;
      if (serverType === 'public') {
        filteredServers = servers.filter(s => !s.isPrivate);
      } else if (serverType === 'private') {
        filteredServers = servers.filter(s => s.isPrivate);
      }

      const totalServers = filteredServers.length;
      const totalPlayers = filteredServers.reduce((sum, s) => sum + (s.playing || 0), 0);
      const maxPlayers = gameInfo.maxPlayers || 50;

      const regions = {};
      for (const server of filteredServers) {
        const region = server.region || 'Unknown';
        if (!regions[region]) regions[region] = 0;
        regions[region]++;
      }

      const activeServers = filteredServers
        .filter(s => s.playing > 0)
        .sort((a, b) => b.playing - a.playing)
        .slice(0, 10);

      const embed = createEmbed({ 
        title: `🖥️ ${gameInfo.name || 'Game'} - Active Servers`,
        description: `Currently-running servers in ${gameInfo.name || 'the game'}.`
      })
        .addFields(
          { name: '📊 Total Servers', value: `\`${totalServers}\``, inline: true },
          { name: '👥 Total Players', value: `\`${totalPlayers}\``, inline: true },
          { name: '📈 Max Players', value: `\`${maxPlayers}\``, inline: true },
          { name: '📋 Type', value: `\`${serverType === 'all' ? 'All' : serverType.charAt(0).toUpperCase() + serverType.slice(1)}\``, inline: true }
        )
        .setTimestamp();

      if (activeServers.length > 0) {
        const serverList = activeServers.map((s, i) =>
          `**${i + 1}.** ${s.playing}/${maxPlayers} players | ${s.id.substring(0, 8)}... | ${s.region || 'Unknown'}`
        ).join('\n');
        embed.addFields({
          name: '🌐 Active Servers',
          value: serverList,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🌐 Active Servers',
          value: '⚠️ No active servers.',
          inline: false,
        });
      }

      const regionSummary = Object.entries(regions)
        .map(([region, count]) => `- ${region}: ${count}`)
        .join('\n');
      if (regionSummary) {
        embed.addFields({
          name: '🗺️ Regions',
          value: regionSummary,
          inline: false,
        });
      }

      embed.setFooter({ text: `Updated: ${new Date().toLocaleString()}` });

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('Servers error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred while fetching server information.',
      });
    }
  },
};