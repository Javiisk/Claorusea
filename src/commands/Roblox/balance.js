import { SlashCommandBuilder } from 'discord.js';
import { getUserData } from '../../utils/economyStorage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check how many coins you have')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Check someone else\'s balance (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = getUserData(target.id);

    await interaction.reply({
      content: `💰 **${target.tag}** has **${data.coins} coins**.`,
    });
  },
};
