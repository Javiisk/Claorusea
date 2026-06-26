import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shout')
    .setDescription('📢 Send an announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message text')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed title')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed description')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const message = interaction.options.getString('message');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const channel = interaction.options.getChannel('channel');

      const embed = new EmbedBuilder()
        .setColor(0x3F3F3F)
        .setTitle(title)
        .setDescription(description);

      await channel.send({
        content: `${message} @everyone`,
        embeds: [embed],
      });

      await interaction.reply({
        content: '✅ Sent!',
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
