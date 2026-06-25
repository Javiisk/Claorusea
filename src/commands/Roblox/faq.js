import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Displays frequently asked questions and helpful information.')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const embed = createEmbed({ title: '📋 Frequently Asked Questions', description: null })
        .setDescription(
          'Hello dear denizen, it seems you need help! Here\'s some information you might need. ' +
          'If you need anything, DM an active staff member and they\'ll be happy to help, I hope you like the information I will give.'
        )
        .setColor(0x5865f2)
        .addFields(
          {
            name: '🌟 How to be an Esteemed Denizen',
            value:
              'Becoming an esteemed denizen is very easy. First of all, follow our YouTube accounts, which can be found at <#1502420447772278875>. ' +
              'Take a screenshot of it and DM a staff member using this format:\n\n' +
              '**Username:**\n**Proofs:** *(the pic you take showing you following our YT channel)*\n\n' +
              'After doing that, wait for a response from the staff and for one of our HR teams to upgrade you to Esteemed Denizen.',
            inline: false,
          },
          {
            name: '⚔️ How to be an Aggressive Denizen',
            value:
              'First of all, buy our game pass, which is located in our main game. Read the description and more.\n\n' +
              'After that, use the command below. You\'ll receive a DM from the bot with an embed. Click **"Verify Purchase"** — if you have the Game Pass, you\'ll be ranked to Aggressive Denizen.\n\n' +
              '> **/applyaggressivedenizen**\n\n' +
              'If you don\'t have the Game Pass, you won\'t be promoted. Good luck, and enjoy your rank and perks!',
            inline: false,
          },
          {
            name: '🏕️ How to be an Untrained Encamp',
            value:
              'To become staff, buy the Game Pass, take a screenshot, and leave your inventory open.\n\n' +
              'After that, DM an available staff member with this form:\n\n' +
              '**Username:**\n**Photos of your inventory or proof that you bought it.**\n\n' +
              'After that, let an HR promote you to Untrained Encamp. Congratulations, you are now untrained camo staff!',
            inline: false,
          },
          {
            name: '📝 The Other Way to be Staff',
            value:
              'Every month, or whenever we need staff, the apps located in the game\'s library next to the NPC will be opened.\n\n' +
              'Remember that your application should be good and have some experience to be able to pass!\n\n' +
              'Sometimes they will open on the server because otherwise the game apps will become overloaded and crash.',
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('FAQ command error:', error.message, error.stack);
      try {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
