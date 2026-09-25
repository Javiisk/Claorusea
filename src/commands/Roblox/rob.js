import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { formatCooldown } from '../../utils/jobs.js';

const ROB_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const SUCCESS_CHANCE = 0.4; // 40%
const MIN_TARGET_COINS = 100; // target needs at least this many coins to be robbable
const STEAL_PERCENT_MIN = 0.1; // 10%
const STEAL_PERCENT_MAX = 0.3; // 30%
const FINE_PERCENT = 0.15; // 15% of your own coins, paid on a failed attempt

export default {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user\'s coins')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to rob')
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot rob yourself.', ephemeral: true });
    }

    if (target.bot) {
      return interaction.reply({ content: '❌ You cannot rob a bot.', ephemeral: true });
    }

    const robberData = getUserData(interaction.user.id);
    const now = Date.now();
    const remaining = ROB_COOLDOWN_MS - (now - robberData.lastRob);

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You're laying low. Try robbing again in **${formatCooldown(remaining)}**.`,
        ephemeral: true,
      });
    }

    const targetData = getUserData(target.id);

    if (targetData.coins < MIN_TARGET_COINS) {
      return interaction.reply({
        content: `❌ **${target.tag}** doesn't have enough coins to be worth robbing.`,
        ephemeral: true,
      });
    }

    robberData.lastRob = now;
    const success = Math.random() < SUCCESS_CHANCE;

    if (success) {
      const percent = STEAL_PERCENT_MIN + Math.random() * (STEAL_PERCENT_MAX - STEAL_PERCENT_MIN);
      const stolen = Math.floor(targetData.coins * percent);

      targetData.coins -= stolen;
      robberData.coins += stolen;

      saveUserData(target.id, targetData);
      saveUserData(interaction.user.id, robberData);

      return interaction.reply({
        content: `🕵️ You successfully robbed **${stolen} coins** from **${target.tag}**! (Balance: ${robberData.coins})`,
      });
    }

    const fine = Math.floor(robberData.coins * FINE_PERCENT);
    robberData.coins = Math.max(0, robberData.coins - fine);
    saveUserData(interaction.user.id, robberData);

    await interaction.reply({
      content: `🚨 You got caught trying to rob **${target.tag}** and paid a fine of **${fine} coins**. (Balance: ${robberData.coins})`,
    });
  },
};
