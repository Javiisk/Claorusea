import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { JOBS, formatCooldown } from '../../utils/jobs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work your job to earn coins'),

  async execute(interaction) {
    const data = getUserData(interaction.user.id);

    if (!data.job || !JOBS[data.job]) {
      return interaction.reply({
        content: '❌ You don\'t have a job yet. Use `/select work` to pick one first.',
        ephemeral: true,
      });
    }

    const job = JOBS[data.job];
    const now = Date.now();
    const remaining = job.cooldownMs - (now - data.lastWork);

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You're tired. Try working again in **${formatCooldown(remaining)}**.`,
        ephemeral: true,
      });
    }

    const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    data.coins += earned;
    data.lastWork = now;
    saveUserData(interaction.user.id, data);

    await interaction.reply({
      content: `💼 You worked as a **${job.label}** and earned **${earned} coins**! (Balance: ${data.coins})`,
    });
  },
};
