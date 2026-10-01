// src/commands/Roblox/eligibles.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { getAllUsers } from '../../utils/hoursStorage.js';
import { getRobloxUserByDiscord, getRobloxUsernameById, getRobloxGroupRank } from '../../utils/bloxlink.js';

const GMT_OFFSET = -6; // GMT-6

// Returns the timestamp of the most recent Monday 00:00 GMT-6
function getWeekStart() {
  const now = new Date();
  // Convert "now" to GMT-6
  const gmt6 = new Date(now.getTime() + GMT_OFFSET * 60 * 60 * 1000);

  // 0 = Sunday, 1 = Monday, ...
  const day = gmt6.getUTCDay();
  // We want the most recent Monday 00:00
  // If today is Monday (1) and it's past 00:00, daysBack = 0
  // Sunday (0) → last Monday was 6 days ago
  const daysBack = day === 0 ? 6 : day - 1;

  const weekStart = new Date(gmt6);
  weekStart.setUTCDate(gmt6.getUTCDate() - daysBack);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart.getTime();
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('eligibles')
    .setDescription('Show eligible members for promotion, demotion, or SOTW')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Type of eligibility list')
        .setRequired(true)
        .addChoices(
          { name: '⬆️ Promotion (30+ min)', value: 'promotion' },
          { name: '⬇️ Demotion (under 30 min)', value: 'demotion' },
          { name: '🏆 SOTW (top shifter)', value: 'sotw' },
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    const type = interaction.options.getString('type');
    const weekStart = getWeekStart();
    const allUsers = getAllUsers();

    const users = [];

    for (const [discordId, data] of Object.entries(allUsers)) {
      if (!data.weeklyMinutes || data.weeklyMinutes <= 0) continue;
      if (data.lastReset && data.lastReset < weekStart) continue;

      let robloxName = 'Unknown';
      let rank = 'N/A';

      try {
        const bloxlinkData = await getRobloxUserByDiscord(discordId);
        if (bloxlinkData?.robloxID) {
          const username = await getRobloxUsernameById(bloxlinkData.robloxID);
          const groupRank = await getRobloxGroupRank(bloxlinkData.robloxID);
          if (username) robloxName = username;
          if (groupRank) rank = groupRank;
        }
      } catch (err) {
        // keep defaults on lookup failure
      }

      users.push({
        discordId,
        robloxName,
        rank,
        minutes: data.weeklyMinutes,
      });
    }

    if (users.length === 0) {
      return interaction.editReply({
        content: '❌ No activity recorded this week yet.',
      });
    }

    let title = '';
    let filtered = [];
    let color = 0x5865F2;

    if (type === 'promotion') {
      title = '⬆️ Eligible for Promotion (30+ min this week)';
      filtered = users
        .filter(u => u.minutes >= 30)
        .sort((a, b) => b.minutes - a.minutes);
      color = 0x57F287;
    } else if (type === 'demotion') {
      title = '⬇️ Eligible for Demotion (under 30 min this week)';
      filtered = users
        .filter(u => u.minutes < 30)
        .sort((a, b) => a.minutes - b.minutes);
      color = 0xED4245;
    } else if (type === 'sotw') {
      title = '🏆 Shifter of the Week';
      const sorted = [...users].sort((a, b) => b.minutes - a.minutes);
      filtered = sorted.slice(0, 1);
      color = 0xFFD700;
    }

    if (filtered.length === 0) {
      return interaction.editReply({
        content: `❌ No users match the **${type}** criteria this week.`,
      });
    }

    const lines = filtered.map((u, i) => {
      const rankEmoji = type === 'sotw' ? '👑' : `#${i + 1}`;
      return `${rankEmoji} **${u.robloxName}** — \`${u.rank}\` — **${formatTime(u.minutes)}**`;
    });

    const description = lines.join('\n').slice(0, 4000);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: 'Resets every Monday 00:00 GMT-6' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};