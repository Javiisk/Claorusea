import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '../../../grouplog-state.json');

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const LOG_CHANNEL_ID = '1504301537109868585';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

// Mapeo de acciones de Roblox
const ACTION_LABELS = {
  'changeRank': '🎖️ Rank Change',
  'kick': '👢 Kick',
  'ban': '🔨 Ban',
  'unban': '✅ Unban',
  'postShout': '📢 Shout',
  'changeDescription': '📝 Description Changed',
  'inviteToClan': '📨 Invite',
  'changeOwner': '👑 Owner Changed',
  'deletePost': '🗑️ Post Deleted',
  'acceptJoinRequest': '✅ Join Accepted',
  'declineJoinRequest': '❌ Join Declined',
  'changeMember': '👤 Member Changed',
  'changeRankPermissions': '🔑 Rank Permissions Changed',
  'createRole': '✨ Role Created',
  'deleteRole': '🗑️ Role Deleted',
  'updateRole': '📝 Role Updated',
};

const ACTION_COLORS = {
  'changeRank': 0x3498DB,
  'kick': 0xED4245,
  'ban': 0xED4245,
  'unban': 0x57F287,
  'postShout': 0xF1C40F,
  'changeDescription': 0xF1C40F,
  'inviteToClan': 0x5865F2,
  'changeOwner': 0x9B59B6,
  'deletePost': 0xED4245,
  'acceptJoinRequest': 0x57F287,
  'declineJoinRequest': 0xED4245,
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function loadState() {
  if (!existsSync(LOG_PATH)) {
    writeFileSync(LOG_PATH, JSON.stringify({ lastTimestamp: null, lastEntries: [] }));
  }
  return JSON.parse(readFileSync(LOG_PATH, 'utf8'));
}

function saveState(state) {
  writeFileSync(LOG_PATH, JSON.stringify(state, null, 2));
}

async function getAuditLog() {
  try {
    const res = await fetch(
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/audit-log?actionType=all&limit=25`,
      { headers: { 'x-api-key': API_KEY } }
    );
    if (!res.ok) throw new Error(`Audit log API error: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    logger.error('[GroupLog] Error fetching audit log:', error);
    return [];
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('grouplog')
    .setDescription('📋 Enable real-time group audit log monitoring')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start monitoring audit logs')
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop monitoring audit logs')
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
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      await startMonitoring(interaction);
    } else if (subcommand === 'stop') {
      await stopMonitoring(interaction);
    } else if (subcommand === 'status') {
      await checkStatus(interaction);
    }
  },
};

// ─── SUBCOMMANDS ────────────────────────────────────────────────────────────

async function startMonitoring(interaction) {
  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const state = loadState();
    state.channelId = LOG_CHANNEL_ID;
    state.monitoring = true;
    state.guildId = interaction.guildId;
    saveState(state);

    // Obtener el último log para no duplicar
    const logs = await getAuditLog();
    if (logs.length > 0) {
      state.lastTimestamp = logs[0].created;
      state.lastEntryId = logs[0].id;
      saveState(state);
    }

    await InteractionHelper.safeEditReply(interaction, {
      content: `✅ **Group audit log monitoring started!**\n📋 Logs will be sent to <#${LOG_CHANNEL_ID}>\n🔄 Checking every 30 seconds.`,
    });

    // Iniciar el monitoreo
    startMonitoringLoop(interaction.client);

    logger.info(`[GroupLog] Monitoring started by ${interaction.user.tag}`);

  } catch (error) {
    logger.error('GroupLog start error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: '❌ An error occurred while starting monitoring.',
    });
  }
}

async function stopMonitoring(interaction) {
  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const state = loadState();
    state.monitoring = false;
    saveState(state);

    await InteractionHelper.safeEditReply(interaction, {
      content: '⏹️ **Group audit log monitoring stopped.**',
    });

    logger.info(`[GroupLog] Monitoring stopped by ${interaction.user.tag}`);

  } catch (error) {
    logger.error('GroupLog stop error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: '❌ An error occurred while stopping monitoring.',
    });
  }
}

async function checkStatus(interaction) {
  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const state = loadState();
    const isActive = state.monitoring === true;

    const embed = new EmbedBuilder()
      .setColor(isActive ? 0x57F287 : 0xED4245)
      .setTitle(isActive ? '🟢 Monitoring Active' : '🔴 Monitoring Inactive')
      .addFields(
        { name: 'Status', value: isActive ? '✅ Active' : '❌ Inactive', inline: true },
        { name: 'Channel', value: state.channelId ? `<#${state.channelId}>` : 'Not set', inline: true },
        { name: 'Last Check', value: state.lastCheck ? new Date(state.lastCheck).toLocaleString() : 'Never', inline: false }
      )
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

  } catch (error) {
    logger.error('GroupLog status error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: '❌ An error occurred.',
    });
  }
}

// ─── MONITORING LOOP ──────────────────────────────────────────────────────

let monitoringInterval = null;

function startMonitoringLoop(client) {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  monitoringInterval = setInterval(async () => {
    try {
      const state = loadState();

      if (!state.monitoring) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        return;
      }

      const logs = await getAuditLog();
      if (logs.length === 0) return;

      let newLogs = [];
      if (state.lastTimestamp) {
        const lastTime = new Date(state.lastTimestamp).getTime();
        newLogs = logs.filter(log => {
          const logTime = new Date(log.created).getTime();
          return logTime > lastTime;
        });
      } else {
        newLogs = logs.slice(0, 5);
      }

      if (newLogs.length > 0) {
        state.lastTimestamp = logs[0].created;
        state.lastCheck = Date.now();
        saveState(state);

        await sendLogsToChannel(client, newLogs);
      }

    } catch (error) {
      logger.error('[GroupLog] Monitoring loop error:', error);
    }
  }, 30000);
}

async function sendLogsToChannel(client, logs) {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const logsToSend = logs.slice(0, 5);

    for (const log of logsToSend) {
      const action = ACTION_LABELS[log.actionType] || `🔹 ${log.actionType}`;
      const color = ACTION_COLORS[log.actionType] || 0x5865F2;
      const actor = log.actor?.user?.username || 'Unknown';
      const actorId = log.actor?.user?.id || 'Unknown';

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(action)
        .setDescription(`**Action:** \`${log.actionType}\``)
        .addFields(
          { name: '👤 Actor', value: `${actor} (${actorId})`, inline: true },
          { name: '🕐 Time', value: formatTimestamp(log.created), inline: true }
        );

      if (log.description) {
        const desc = log.description;
        let details = '';

        if (desc.TargetName) details += `Target: ${desc.TargetName}\n`;
        if (desc.OldRoleName) details += `Old Role: ${desc.OldRoleName}\n`;
        if (desc.NewRoleName) details += `New Role: ${desc.NewRoleName}\n`;
        if (desc.UserName) details += `User: ${desc.UserName}\n`;
        if (desc.Reason) details += `Reason: ${desc.Reason}\n`;

        if (details) {
          embed.addFields({ name: '📋 Details', value: details, inline: false });
        }
      }

      embed.setFooter({ text: `Log ID: ${log.id}` });

      await channel.send({ embeds: [embed] });
    }

  } catch (error) {
    logger.error('[GroupLog] Error sending logs to channel:', error);
  }
}
