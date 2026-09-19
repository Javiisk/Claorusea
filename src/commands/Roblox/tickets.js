import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { buildPanelContainer } from '../../utils/ticketPanel.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Sends a ticket panel to a channel')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which ticket panel to send')
        .setRequired(true)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Staff', value: 'staff' },
        )
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Where to send the ticket panel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    const container = buildPanelContainer(type);

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.reply({
      content: `✅ ${type === 'staff' ? 'Staff' : 'All'} ticket panel sent to ${channel}.`,
      ephemeral: true,
    });
  },
};
