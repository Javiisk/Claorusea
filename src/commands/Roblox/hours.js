// src/commands/Roblox/hours.js
import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
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

    const container = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `<:stopwatch:1560089346000945242> **You have ${weekly} so far this week.**`,
            `Your most recent shift was **${lastSession}** long.`,
            `📍 Last joined: ${lastJoin}`,
            `🔗 Need shifting tips? Visit <#${process.env.SHIFTING_TIPS_CHANNEL_ID || '000000000000000000'}>`,
          ].join('\n'),
        ),
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
