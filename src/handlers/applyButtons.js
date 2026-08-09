// src/handlers/applyButtons.js

import { logger } from '../utils/logger.js';

const applyStartHandler = {
  name: 'apply_start',
  async execute(interaction, client, args) {
    try {
      // Solo el mismo usuario puede usar el botón
      if (interaction.user.id !== args[0]) {
        return await interaction.reply({ 
          content: '❌ This button is not for you.', 
          ephemeral: true 
        });
      }

      const button = await import('../interactions/buttons/apply_start/apply_start.js');
      await button.default.execute(interaction);

    } catch (error) {
      logger.error('Apply start button error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true,
        });
      }
    }
  },
};

export { applyStartHandler };