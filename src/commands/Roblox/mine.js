import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { formatCooldown } from '../../utils/jobs.js';

const MINE_COOLDOWN_MS = 25 * 60 * 1000;
const MIN_EARN = 40;
const MAX_EARN = 110;

export default {
  data: new SlashCommandBuilder()
    .setName('mine')
    .setDescription('Go mining (requires a Pickaxe)'),

  async execute(interaction) {
    const data = getUserData(interaction.user.id);

    if (!data.inventory.pickaxe) {
      return interaction.reply({
        content: '❌ You need a **Pickaxe** to mine. Buy one with `/buy item:Pickaxe`.',
        ephemeral: true,
      });
    }

    const now = Date.now();
    const remaining = MINE_COOLDOWN_MS - (now - data.lastMine);

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ Your pickaxe needs to cool down. Try again in **${formatCooldown(remaining)}**.`,
        ephemeral: true,
      });
    }

    const earned = Math.floor(Math.random() * (MAX_EARN - MIN_EARN + 1)) + MIN_EARN;
    data.coins += earned;
    data.lastMine = now;
    saveUserData(interaction.user.id, data);

    await interaction.reply({
      content: `⛏️ You went mining and sold your ores for **${earned} coins**! (Balance: ${data.coins})`,
    });
  },
};
