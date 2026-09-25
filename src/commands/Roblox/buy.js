import { SlashCommandBuilder } from 'discord.js';
import { getUserData, saveUserData } from '../../utils/economyStorage.js';
import { SHOP_ITEMS } from '../../utils/shopItems.js';

export default {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the shop')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('The item to buy')
        .setRequired(true)
        .addChoices(...Object.entries(SHOP_ITEMS).map(([key, item]) => ({ name: item.label, value: key })))
    ),

  async execute(interaction) {
    const itemKey = interaction.options.getString('item');
    const item = SHOP_ITEMS[itemKey];

    const data = getUserData(interaction.user.id);

    if (data.inventory[item.inventoryKey]) {
      return interaction.reply({
        content: `❌ You already own a **${item.label}**.`,
        ephemeral: true,
      });
    }

    if (data.coins < item.price) {
      return interaction.reply({
        content: `❌ You need **${item.price} coins** to buy a **${item.label}** (you have ${data.coins}).`,
        ephemeral: true,
      });
    }

    data.coins -= item.price;
    data.inventory[item.inventoryKey] = true;
    saveUserData(interaction.user.id, data);

    await interaction.reply({
      content: `✅ You bought a **${item.label}** for ${item.price} coins! (Balance: ${data.coins})`,
    });
  },
};
