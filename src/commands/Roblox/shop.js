import { SlashCommandBuilder } from 'discord.js';
import { SHOP_ITEMS } from '../../utils/shopItems.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View items available for purchase'),

  async execute(interaction) {
    const lines = Object.values(SHOP_ITEMS).map(item => `**${item.label}** — ${item.price} coins`);

    await interaction.reply({
      content: ['🛒 **Shop**', '', ...lines, '', 'Use `/buy item:` to purchase one.'].join('\n'),
    });
  },
};
