import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { JOBS } from '../../utils/jobs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('select')
    .setDescription('Select your job')
    .addStringOption(opt =>
      opt.setName('work')
        .setDescription('The job you want to work')
        .setRequired(true)
        .addChoices(...Object.entries(JOBS).map(([key, job]) => ({ name: job.label, value: key })))
    ),

  async execute(interaction) {
    const jobKey = interaction.options.getString('work');
    const job = JOBS[jobKey];

    const data = getUserData(interaction.user.id);
    data.job = jobKey;
    saveUserData(interaction.user.id, data);

    await interaction.reply({
      content: `✅ You are now working as a **${job.label}**. Use \`/work\` to earn coins!`,
      ephemeral: true,
    });
  },
};
