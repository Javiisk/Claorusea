import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { formatCooldown } from '../../utils/jobs.js';

const FISH_COOLDOWN_MS = 20 * 60 * 1000;
const MIN_EARN = 30;
const MAX_EARN = 90;

export default {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Go fishing (requires a Fishing Rod)'),

  async execute(interaction) {
    const data = getUserData(interaction.user.id);

    if (!data.inventory.fishingrod) {
      return interaction.reply({
        content: '❌ You need a **Fishing Rod** to fish. Buy one with `/buy item:Fishing Rod`.',
        ephemeral: true,
      });
    }

    const now = Date.now();
    const remaining = FISH_COOLDOWN_MS - (now - data.lastFish);

    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ The fish aren't biting yet. Try again in **${formatCooldown(remaining)}**.`,
        ephemeral: true,
      });
    }

    const earned = Math.floor(Math.random() * (MAX_EARN - MIN_EARN + 1)) + MIN_EARN;
    data.coins += earned;
    data.lastFish = now;
    saveUserData(interaction.user.id, data);

    await interaction.reply({
      content: `🎣 You went fishing and sold your catch for **${earned} coins**! (Balance: ${data.coins})`,
    });
  },
};
