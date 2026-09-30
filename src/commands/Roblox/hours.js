// src/commands/Roblox/hours.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getHoursData } from '../../utils/hoursStorage.js';

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h} hours and ${m} minutes`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('hours')
    .setDescription('Check how many hours you have played this week')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check hours for')
        .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = getHoursData(target.id);

    const weekly = formatTime(data.weeklyMinutes || 0);
    const lastSession = formatTime(data.lastSessionMinutes || 0);
    const lastJoin = data.lastJoinTimestamp
      ? `<t:${Math.floor(data.lastJoinTimestamp / 1000)}:R>`
      : 'Never';

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(
        `✅ **You have ${weekly} so far this week.**\n` +
        `Your most recent shift was **${lastSession}** long.\n` +
        `📍 Last joined: ${lastJoin}\n` +
        `🔗 Need shifting tips? Visit <#${process.env.SHIFTING_TIPS_CHANNEL_ID || '000000000000000000'}>`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};