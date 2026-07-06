import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// ─── FUNCIÓN DE RESET SEMANAL ─────────────────────────────────────────────

function getWeeklyResetInfo() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const resetDate = new Date(now);
    resetDate.setDate(now.getDate() + daysUntilMonday);
    resetDate.setHours(0, 0, 0, 0);
    
    // Calcular horas y minutos restantes
    const msUntilReset = resetDate.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
        resetTime: resetDate,
        daysUntilReset: daysUntilMonday,
        hoursUntilReset: hoursUntilReset,
        minutesUntilReset: minutesUntilReset,
        resetTimestamp: Math.floor(resetDate.getTime() / 1000),
        nowTimestamp: Math.floor(now.getTime() / 1000),
    };
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('resetinfo')
        .setDescription('🔄 Get info about weekly shift time reset')
        .setDMPermission(true),

    async execute(interaction) {
        await InteractionHelper.safeDefer(interaction, { ephemeral: false });

        try {
            const resetInfo = getWeeklyResetInfo();

            // ─── CREAR EMBED ──────────────────────────────────────────────

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🔄 Weekly Shift Time Reset')
                .setDescription('Information about when your weekly shift time resets.')
                .addFields(
                    { name: '📅 Next Reset', value: `<t:${resetInfo.resetTimestamp}:F>`, inline: false },
                    { name: '📆 Days Until Reset', value: `\`${resetInfo.daysUntilReset} day(s)\``, inline: true },
                    { name: '⏰ Hours Until Reset', value: `\`${resetInfo.hoursUntilReset}h ${resetInfo.minutesUntilReset}m\``, inline: true },
                    { name: '🕐 Current Time', value: `<t:${resetInfo.nowTimestamp}:F>`, inline: false },
                    { name: '📋 Reset Schedule', value: 'Shift time resets **every Monday at 00:00 UTC**', inline: false }
                )
                .setFooter({ text: 'Shift time is tracked per user via DataStore' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        } catch (error) {
            logger.error('ResetInfo error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ An error occurred while fetching reset info.',
            });
        }
    },
};