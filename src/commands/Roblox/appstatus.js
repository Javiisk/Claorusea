// src/commands/Roblox/appstatus.js
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setAppsStatus } from '../../utils/presence.js';

export default {
  data: new SlashCommandBuilder()
    .setName('appstatus')
    .setDescription('Enable or disable the "Reviewing Apps" state in the rotation')
    .addStringOption(opt =>
      opt.setName('status')
        .setDescription('Enable or disable')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'enable' },
          { name: 'Disable', value: 'disable' }
        ))
    .setDefaultMemberPermissions(8), // Solo admins

  async execute(interaction) {
    const status = interaction.options.getString('status');
    const isOpen = status === 'enable';

    // Llamamos a la función de presencia para añadir/quitar el estado
    setAppsStatus(interaction.client, isOpen);

    await interaction.reply({
      content: isOpen 
        ? '✅ **Apps status ENABLED.** The "Reviewing Apps" state has been added to the rotation.' 
        : '✅ **Apps status DISABLED.** The "Reviewing Apps" state has been removed from the rotation.',
      flags: MessageFlags.Ephemeral,
    });
  },
};