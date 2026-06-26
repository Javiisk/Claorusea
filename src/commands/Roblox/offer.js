import { SlashCommandBuilder } from 'discord.js';

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

export default {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('🎯 Offer a rank to a user')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('Roblox username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Rank to offer')
        .setRequired(true)
        .addChoices(
          { name: 'Guest', value: 'Guest' },
          { name: 'Denizen', value: 'Denizen' },
          { name: 'Esteemed Denizen', value: 'Esteemed Denizen' },
          { name: 'Agressive Denizen', value: 'Agressive Denizen' },
          { name: 'Honored Denizen', value: 'Honored Denizen' },
          { name: 'Untrained Encamp', value: 'Untrained Encamp' },
          { name: 'Camp Volunteer', value: 'Camp Volunteer' },
          { name: 'Camp Activist', value: 'Camp Activist' },
          { name: 'Camp Counselour', value: 'Camp Counselour' },
          { name: 'Camp Coordinator', value: 'Camp Coordinator' },
          { name: 'Camp Supervisor', value: 'Camp Supervisor' },
          { name: 'Camp Council', value: 'Camp Council' },
          { name: 'Domain Superior', value: 'Domain Superior' },
          { name: 'Domain Delegate', value: 'Domain Delegate' },
          { name: 'Domain Confidant', value: 'Domain Confidant' },
          { name: 'Domain Regent', value: 'Domain Regent' }
        )),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    const user = interaction.options.getString('user');
    const rank = interaction.options.getString('rank');

    await interaction.reply({
      content: `✅ Offer created for **${user}** (${rank})!`,
      ephemeral: true,
    });
  },
};
