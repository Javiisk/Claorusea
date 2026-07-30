import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('⏱️ Create a countdown timer')
        .addIntegerOption(option =>
            option
                .setName('seconds')
                .setDescription('Number of seconds to countdown (1-3600)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(3600)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Message to display when countdown ends')
                .setRequired(false)
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('Countdown defer failed', {
                userId: interaction.user.id,
                commandName: 'countdown'
            });
            return;
        }

        try {
            const seconds = interaction.options.getInteger('seconds');
            const message = interaction.options.getString('message') || '⏰ Time is up!';

            await InteractionHelper.safeEditReply(interaction, {
                content: `⏱️ Countdown started for **${seconds}** seconds!`,
            });

            let remaining = seconds;
            const interval = setInterval(async () => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    await interaction.followUp({
                        content: `🔔 ${message}`,
                    });
                } else if (remaining % 10 === 0 || remaining <= 5) {
                    await interaction.editReply({
                        content: `⏱️ ${remaining} seconds remaining...`,
                    });
                }
            }, 1000);

        } catch (error) {
            logger.error('Countdown error:', error);
            await InteractionHelper.safeReply(interaction, {
                content: '❌ An error occurred.',
            });
        }
    },
};