import { SlashCommandBuilder } from 'discord.js';
import { getUserData } from '../../utils/economyStorage.js';
import { xpForNextAscension } from '../../utils/leveling.js';

export default {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('View your current Ascension and progress')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Check someone else\'s level (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = getUserData(target.id);
    const needed = xpForNextAscension(data.ascension);

    await interaction.reply({
      content: [
        `**${target.tag}**`,
        `🌠 Ascension: **${data.ascension}**`,
        `✨ XP: **${data.xp} / ${needed}**`,
        `💰 Coins: **${data.coins}**`,
      ].join('\n'),
    });
  },
};
