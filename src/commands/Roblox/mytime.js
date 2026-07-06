import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;
const OPENCLOUD_API_KEY = process.env.OPENCLOUD_API_KEY;

// ─── OBTENER HORAS DE JUEGO DESDE DATASTORE ──────────────────────────────

async function getPlaytimeFromDataStore(robloxId) {
    try {
        const url = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/user-data-stores/Playtime/entries/user-${robloxId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-api-key': OPENCLOUD_API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { success: true, playtime: 0, error: null };
            }
            throw new Error(`API error ${response.status}`);
        }

        const data = await response.json();
        const playtimeSeconds = data.value || 0;
        return { success: true, playtime: playtimeSeconds, error: null };
    } catch (error) {
        logger.error('[MyTime] Error fetching playtime:', error);
        return { success: false, playtime: 0, error: error.message };
    }
}

// ─── OBTENER RANGO DEL GRUPO ──────────────────────────────────────────────

async function getRobloxGroupRank(userId) {
    try {
        const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        const data = await res.json();
        const group = data.data?.find(g => String(g.group.id) === String(GROUP_ID));
        return group ? group.role.name : 'Not in the group';
    } catch {
        return 'Error fetching rank';
    }
}

// ─── FORMATO DE TIEMPO ──────────────────────────────────────────────────────

function formatPlaytime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function getWeeklyResetInfo() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const resetDate = new Date(now);
    resetDate.setDate(now.getDate() + daysUntilMonday);
    resetDate.setHours(0, 0, 0, 0);
    
    return {
        resetTime: resetDate,
        daysUntilReset: daysUntilMonday,
        resetTimestamp: Math.floor(resetDate.getTime() / 1000),
    };
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('mytime')
        .setDescription('⏱️ Get your weekly shift time, rank, and Roblox ID')
        .setDMPermission(true),

    async execute(interaction) {
        await InteractionHelper.safeDefer(interaction, { ephemeral: false });

        try {
            const targetUser = interaction.user;

            // ─── OBTENER INFO DE ROBLOX VIA BLOXLINK ──────────────────────

            const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

            if (!userInfo) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ You do not have a Roblox account linked in this server.`,
                });
            }

            const robloxId = userInfo.id;
            const robloxUsername = userInfo.username;

            // ─── OBTENER HORAS DE JUEGO ────────────────────────────────────

            const playtimeResult = await getPlaytimeFromDataStore(robloxId);
            
            if (!playtimeResult.success) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ Could not fetch playtime data for **${robloxUsername}**.`,
                });
            }

            // ─── OBTENER RANGO ──────────────────────────────────────────────

            const rank = await getRobloxGroupRank(robloxId);

            // ─── INFO DE RESET SEMANAL ─────────────────────────────────────

            const resetInfo = getWeeklyResetInfo();
            const formattedTime = formatPlaytime(playtimeResult.playtime);
            const hoursDecimal = (playtimeResult.playtime / 3600).toFixed(1);

            // ─── CREAR EMBED ──────────────────────────────────────────────

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`⏱️ ${robloxUsername}'s Weekly Shift Time`)
                .setDescription(`Get your weekly shift time, rank, and Roblox ID.`)
                .addFields(
                    { name: '⏱️ Shift Time', value: `\`${formattedTime}\` (${hoursDecimal} hours)`, inline: false },
                    { name: '📊 Rank', value: `\`${rank}\``, inline: true },
                    { name: '🆔 Roblox ID', value: `\`${robloxId}\``, inline: true },
                    { name: '👤 Discord User', value: `${targetUser}`, inline: true },
                    { name: '🔄 Weekly Reset', value: `<t:${resetInfo.resetTimestamp}:F>`, inline: false },
                    { name: '📅 Days Until Reset', value: `\`${resetInfo.daysUntilReset} day(s)\``, inline: true }
                )
                .setFooter({ text: 'Shift time resets every Monday at 00:00 UTC' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        } catch (error) {
            logger.error('MyTime error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ An error occurred while fetching your shift time.',
            });
        }
    },
};