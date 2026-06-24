import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, logger, InteractionHelper } from '../../utils/index.js';
import fetch from 'node-fetch';

const GAME_ID = 90664126150507;

export default {
    data: new SlashCommandBuilder()
        .setName('gameinfo')
        .setDescription('Displays real-time server count and active players for the campgrounds.'),

    async execute(interaction) {
        // Evitamos que la interacción expire en Railway
        await InteractionHelper.safeDefer(interaction);

        try {
            // 1. Petición para contar servidores y jugadores activos
            const serverResponse = await fetch(`https://games.roblox.com/v1/games/2/places/${GAME_ID}/servers/Public?limit=100`);
            
            if (!serverResponse.ok) {
                throw new Error(`Roblox API returned status ${serverResponse.status}`);
            }
            
            const serverData = await serverResponse.json();

            let totalPlayers = 0;
            let activeServers = 0;

            if (serverData.data && serverData.data.length > 0) {
                activeServers = serverData.data.length;
                for (const server of serverData.data) {
                    totalPlayers += server.playing;
                }
            }

            // 2. Petición para obtener el icono oficial del juego
            const iconResponse = await fetch(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${GAME_ID}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
            let gameIconUrl = null;

            if (iconResponse.ok) {
                const iconData = await iconResponse.json();
                if (iconData.data && iconData.data.length > 0) {
                    gameIconUrl = iconData.data[0].imageUrl;
                }
            }

            // 3. Construcción del Embed estético de Adoresa
            const embed = createEmbed()
                .setTitle('🌲 Adoresa — Camp Status')
                .setDescription('Current real-time activity at the campgrounds.')
                .setColor('#2f3136')
                .addFields(
                    { name: '🎮 Active Players', value: `• **${totalPlayers}** campers online`, inline: true },
                    { name: '🖥️ Active Servers', value: `• **${activeServers}** server(s) running`, inline: true },
                    { name: '🔗 Quick Link', value: `[Join Adoresa Campgrounds](https://www.roblox.com/games/${GAME_ID})`, inline: false }
                )
                .setTimestamp();

            if (gameIconUrl) {
                embed.setThumbnail(gameIconUrl);
            }

            // 4. Envío seguro de la respuesta editando el reply diferido
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        } catch (error) {
            logger.error(`Error in /gameinfo command: ${error.message}`);
            await InteractionHelper.safeEditReply(interaction, {
                content: '⚠️ Unable to fetch game analytics at this moment. Please try again later.'
            });
        }
    }
};
