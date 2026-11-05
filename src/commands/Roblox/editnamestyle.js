// src/commands/Roblox/editnamestyle.js
import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// IDs oficiales de los efectos y fuentes de Discord
const FONTS = {
  'gg_sans': 1,
  'tempo': 2,
  'sakura': 3,
  'jellybean': 4,
  'modern': 5,
  'medieval': 6,
  '8bit': 7,
  'vampyre': 8,
  'monkey_bars': 9,
  'mainframe': 10,
  'headbang': 11,
  'journal': 12
};

const EFFECTS = {
  'solid': 1,
  'gradient': 2,
  'neon': 3,
  'toon': 4,
  'pop': 5,
  'gummy': 6,
  'prism': 7
};

export default {
  data: new SlashCommandBuilder()
    .setName('editnamestyle')
    .setDescription('Change the bot\'s display name style')
    .setDefaultMemberPermissions(8), // Solo admins

  async execute(interaction) {
    // Creamos el panel visual idéntico a la foto
    const container = new ContainerBuilder()
      .setAccentColor(0x2B2D31)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Máriposa • Display Name Style\n\n**Effect**\n\nGradient`)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('style_effect_select')
            .setPlaceholder('Select Effect')
            .addOptions([
              { label: 'Solid', value: 'solid' },
              { label: 'Gradient', value: 'gradient' },
              { label: 'Neon', value: 'neon' },
              { label: 'Toon', value: 'toon' },
              { label: 'Pop', value: 'pop' },
              { label: 'Gummy', value: 'gummy' },
              { label: 'Prism', value: 'prism' },
            ])
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('style_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('style_font').setLabel('Font').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('style_effect').setLabel('Effect').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('style_colors').setLabel('Colors').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('style_update').setLabel('Update').setStyle(ButtonStyle.Success)
        )
      );

    await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
};
