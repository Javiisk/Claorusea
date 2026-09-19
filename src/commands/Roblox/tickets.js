import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { buildPanelContainer } from '../../utils/ticketPanel.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Sends the ticket panel to a channel')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Where to send the ticket panel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const container = buildPanelContainer();

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.reply({
      content: `✅ Ticket panel sent to ${channel}.`,
      ephemeral: true,
    });
  },
};
