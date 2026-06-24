import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, logger, InteractionHelper } from '../../utils/index.js'; // Subimos dos niveles (../) porque ahora estamos dentro de /roblox/
import fetch from 'node-fetch';

const GAME_ID = 90664126150507; // El ID de tu juego de Adoresa

export default {
    data: new SlashCommandBuilder()
        .setName('gameinfo')
        .setDescription('Displays real-time server count and active players for the campgrounds.'),

    async execute(interaction) {
        // Aseguramos la interacción para evitar expiración en Railway/móvil
        await InteractionHelper.safeDefer(interaction);

        try {
            // 1. Llamada a la API de servidores públicos para contar jugadores y servidores
            const serverResponse = await fetch(`https://games.roblox.com/v1/games/2/places/${GAME_ID}/servers/Public?limit=100`);
            const serverData = await serverResponse.json();

            let totalPlayers = 0;
            let activeServers = 0;

            if (serverData.data && serverData.data.length > 0) {
                activeServers = serverData.data.length;
                for (const server of serverData.data) {
                    totalPlayers += server.playing;
                }
            }

            // 2. Llamada a la API de Thumbnails para obtener el icono del juego (Game Icon)
            // Usamos el tamaño 150x150 en formato circular/cuadrado oficial
            const iconResponse = await fetch(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${GAME_ID}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
            const iconData = await iconResponse.json();
            
            let gameIconUrl = null;
            if (iconData.data && iconData.data.length > 0) {
                gameIconUrl = iconData.data[0].imageUrl;
            }

            // 3. Crear el Embed con la estética de Adoresa y su Icono
            const embed = createEmbed()
                .setTitle(`🌲 Adoresa — Camp Status`)
                .setDescription(`Current real-time activity at the campgrounds.`)
                .setColor('#2f3136') // Color oscuro/estético
                .addFields(
                    { name: '🎮 Active Players', value: `• **${totalPlayers}** campers online`, inline: true },
                    { name: '🖥️ Active Servers', value: `• **${activeServers}** server(s) running`, inline: true },
                    { name: '🔗 Quick Link', value: `[Join Adoresa Campgrounds](https://www.roblox.com/games/${GAME_ID})`, inline: false }
                )
                .setTimestamp();

            // Si la API nos devolvió la imagen con éxito, la inyectamos como Thumbnail
            if (gameIconUrl) {
                embed.setThumbnail(gameIconUrl);
            }

            // Enviamos la respuesta editando el defer de forma segura
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        } catch (error) {
            logger.error(`Error in /gameinfo command: ${error.message}`);
            await InteractionHelper.safeEditReply(interaction, {
                content: '⚠️ Unable to fetch game analytics at this moment. Please try again later.'
            });
        }
    }
};

