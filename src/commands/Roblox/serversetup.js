import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../../server-monitor-config.json');

const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify({
      enabled: false,
      channelId: null,
      messageId: null,
      interval: 60,
    }));
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

async function getGameServers() {
  try {
    const url = `https://games.roblox.com/v1/games/${UNIVERSE_ID}/servers/Public?limit=100`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    logger.error('[ServerMonitor] Error fetching servers:', error);
    return [];
  }
}

async function getGameInfo() {
  try {
    const url = `https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`;
    const response = await fetch(url, {
      headers: { 'x-api-key': ROBLOX_API_KEY }
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.data?.[0] || null;
  } catch (error) {
    logger.error('[ServerMonitor] Error fetching game info:', error);
    return null;
  }
}

async function generateEmbed() {
  const [servers, gameInfo] = await Promise.all([
    getGameServers(),
    getGameInfo(),
  ]);

  if (!gameInfo) {
    return new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Error')
      .setDescription('Could not fetch game information.');
  }

  const totalServers = servers.length;
  const totalPlayers = servers.reduce((sum, s) => sum + (s.playing || 0), 0);
  const maxPlayers = gameInfo.maxPlayers || 50;

  const regions = {};
  for (const server of servers) {
    const region = server.region || 'Unknown';
    if (!regions[region]) regions[region] = 0;
    regions[region]++;
  }

  const activeServers = servers
    .filter(s => s.playing > 0)
    .sort((a, b) => b.playing - a.playing)
    .slice(0, 8);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🖥️ ${gameInfo.name || 'Game'} - Active Servers`)
    .setDescription(`Currently-running servers in ${gameInfo.name || 'the game'}.`)
    .addFields(
      { name: '📊 Total Servers', value: `\`${totalServers}\``, inline: true },
      { name: '👥 Total Players', value: `\`${totalPlayers}\``, inline: true },
      { name: '📈 Max Players', value: `\`${maxPlayers}\``, inline: true }
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

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('serversetup')
    .setDescription('🖥️ Setup server monitor in a channel')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start monitoring servers')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send server updates')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('interval')
            .setDescription('Update interval in seconds (default: 60)')
            .setRequired(false)
            .setMinValue(10)
            .setMaxValue(300)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop monitoring servers')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Check monitoring status')
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      const channel = interaction.options.getChannel('channel');
      const interval = interaction.options.getInteger('interval') || 60;

      await InteractionHelper.safeDefer(interaction, { ephemeral: true });

      try {
        const embed = await generateEmbed();
        const message = await channel.send({ embeds: [embed] });

        const config = loadConfig();
        config.enabled = true;
        config.channelId = channel.id;
        config.messageId = message.id;
        config.interval = interval;
        saveConfig(config);

        if (global.serverMonitorInterval) {
          clearInterval(global.serverMonitorInterval);
        }

        global.serverMonitorInterval = setInterval(async () => {
          try {
            const cfg = loadConfig();
            if (!cfg.enabled) {
              clearInterval(global.serverMonitorInterval);
              global.serverMonitorInterval = null;
              return;
            }

            const channel = await interaction.client.channels.fetch(cfg.channelId);
            if (!channel) {
              clearInterval(global.serverMonitorInterval);
              global.serverMonitorInterval = null;
              return;
            }

            const newEmbed = await generateEmbed();
            const message = await channel.messages.fetch(cfg.messageId);
            if (message) {
              await message.edit({ embeds: [newEmbed] });
            }
          } catch (error) {
            logger.error('[ServerMonitor] Update error:', error);
          }
        }, interval * 1000);

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ Server monitor started in <#${channel.id}>. Updates every ${interval} seconds.`,
        });

      } catch (error) {
        logger.error('ServerMonitor start error:', error);
        await InteractionHelper.safeEditReply(interaction, {
          content: `❌ An error occurred: ${error.message}`,
        });
      }
    }

    if (subcommand === 'stop') {
      await InteractionHelper.safeDefer(interaction, { ephemeral: true });

      try {
        const config = loadConfig();
        config.enabled = false;
        saveConfig(config);

        if (global.serverMonitorInterval) {
          clearInterval(global.serverMonitorInterval);
          global.serverMonitorInterval = null;
        }

        await InteractionHelper.safeEditReply(interaction, {
          content: '⏹️ Server monitor stopped.',
        });

      } catch (error) {
        logger.error('ServerMonitor stop error:', error);
        await InteractionHelper.safeEditReply(interaction, {
          content: `❌ An error occurred: ${error.message}`,
        });
      }
    }

    if (subcommand === 'status') {
      await InteractionHelper.safeDefer(interaction, { ephemeral: true });

      try {
        const config = loadConfig();
        const isActive = config.enabled && config.channelId;

        const embed = new EmbedBuilder()
          .setColor(isActive ? 0x57F287 : 0xED4245)
          .setTitle(isActive ? '🟢 Server Monitor Active' : '🔴 Server Monitor Inactive')
          .addFields(
            { name: 'Status', value: isActive ? '✅ Active' : '❌ Inactive', inline: true },
            { name: 'Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
            { name: 'Update Interval', value: isActive ? `\`${config.interval || 60} seconds\`` : '`N/A`', inline: true }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

      } catch (error) {
        logger.error('ServerMonitor status error:', error);
        await InteractionHelper.safeEditReply(interaction, {
          content: `❌ An error occurred: ${error.message}`,
        });
      }
    }
  },
};